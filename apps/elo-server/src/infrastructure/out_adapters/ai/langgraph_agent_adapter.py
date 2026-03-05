import operator
from typing import Any, List, Optional, Sequence, Type, TypedDict, Annotated, Literal, Dict
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
import os
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, BaseMessage, SystemMessage
from langchain_core.runnables import Runnable

from src.domain.ports.ai_port import AIPort


from src.infrastructure.logging.langchain_callback_handler import PromptLoggingCallbackHandler


class ChatInputSchema(BaseModel):
    """Input schema for the chat agent. LangServe uses this to build the Playground UI."""
    messages: Sequence[AnyMessage] = Field(
        ...,
        description="The list of chat messages",
    )

class Plan(BaseModel):
    """A list of steps to accomplish a task."""
    steps: List[str] = Field(description="A sequential list of actions required to accomplish the user's objective.")

class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    plan: List[str]
    delegation_reason: Optional[str]

class LangGraphAgentAdapter(AIPort, Runnable):

    @property
    def input_schema(self) -> Type[BaseModel]:
        return ChatInputSchema

    @property
    def output_schema(self) -> Type[BaseModel]:
        return AIMessage

    def __init__(self, api_key: str, model_name: str = "gemini-1.5-flash", tools: Optional[List] = None, base_storage_path: str = "workspace/users", vault_path: Optional[str] = None):
        if not api_key:
            raise ValueError("API key must be provided")
            
        self.callbacks = [PromptLoggingCallbackHandler(provider="google")]
        self.llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.7
        )
        
        self.tools = tools or []
        self.base_storage_path = Path(base_storage_path)
        self.vault_path = Path(vault_path) if vault_path else None
        if not self.base_storage_path.exists():
            self.base_storage_path.mkdir(parents=True, exist_ok=True)
            
        self.checkpointer = MemorySaver()
        self.graph = None
        
        # Load vault schema if available
        self.vault_schema = self._load_vault_schema()
        
        self._initialize_agent()

    def _load_vault_schema(self) -> dict:
        """Loads frontmatter keys from .obsidian/types.json if it exists."""
        if not self.vault_path:
            return {}
            
        # Try both direct path and inside .obsidian
        schema_path = self.vault_path / ".obsidian" / "types.json"
        if not schema_path.exists():
            return {}

        try:
            import json
            with open(schema_path, "r") as f:
                data = json.load(f)
                return data.get("types", {})
        except Exception as e:
            print(f"Warning: Could not load vault schema: {e}")
            return {}

    def _initialize_agent(self):
        """
        Initializes the custom Plan-and-Execute StateGraph with MemorySaver persistence and system prompt.
        """
        system_msg = (
            "You are a powerful AI assistant with full access to an Obsidian vault and an n8n automation environment. "
            "You can read, search, and modify notes, as well as list, call, and CREATE n8n workflows. "
            "\\n\\nProactivity: If a user asks for a capability you don't have (like WhatsApp integration or email notifications), "
            "check if you can solve it by CREATE-ing an n8n workflow. If you can't build it yourself, "
            "delegate the task to a human with a clear description of what's needed. "
            "\\n\\nCRITICAL: If you encounter a task that you cannot complete with your current tools, "
            "OR if you need to ask the user a question, clarify requirements, or get permission to proceed, "
            "you MUST use the 'delegate_to_human' tool. "
            "Call it as: delegate_to_human(analysis='why you are stuck', proposed_solution='what you need from the human'). "
            "Do NOT wrap the tool call in markdown code blocks. Use the tool calling API provided to you. "
            "Do NOT ask questions, offer options, or explain why you can't do it in your final response text; use the tool instead. "
            "If you see a '<!-- DELEGATED_TO_HUMAN -->' marker in the task, it means you have already asked for help. "
            "Check for any new human-written notes or updated instructions in the vault or workspace before continuing."
        )
        
        if self.vault_schema:
            schema_keys = ", ".join(list(self.vault_schema.keys()))
            system_msg += (
                f"\\n\\nVault Metadata Schema (Frontmatter keys):\\n{schema_keys}\\n"
                "When searching or querying notes, use these exact keys in your queries if possible. "
                "Be aware of accents and specific naming (e.g., 'Oficios', 'Profesión')."
            )

        system_msg += (
            "\\n\\nIf a tool fails due to missing content or search issues, try using "
            "the Filesystem tools as a fallback or broaden your search."
        )

        async def planner_node(state: AgentState):
            messages = state.get("messages", [])
            
            # The planner doesn't have tools, it just creates a step-by-step plan
            planner = self.llm.with_structured_output(Plan)
            planner_prompt = SystemMessage(
                content="You are an expert planner. Create a step-by-step plan to accomplish the user's objective based on the conversation history. Keep the steps clear and actionable."
            )
            
            # Use all prior messages to generate the plan
            plan_result = await planner.ainvoke([planner_prompt] + messages)
            return {"plan": plan_result.steps}

        async def executor_node(state: AgentState):
            messages = state.get("messages", [])
            plan = state.get("plan", [])
            
            plan_text = "\\n".join([f"{i+1}. {step}" for i, step in enumerate(plan)])
            executor_sys_msg = f"{system_msg}\\n\\nHere is your step-by-step plan:\\n{plan_text}\\n\\nExecute the plan step-by-step."
            
            # Create a localized ReAct agent for execution
            executor_agent = create_react_agent(
                self.llm, 
                self.tools, 
                prompt=executor_sys_msg
            )
            
            # Execute taking the entire message history
            result = await executor_agent.ainvoke({"messages": messages})
            
            new_msgs = result["messages"][len(messages):]
            
            delegation_reason = None
            for msg in reversed(new_msgs):
                if hasattr(msg, "content") and "DELEGATED_TO_HUMAN:" in str(msg.content):
                    delegation_reason = str(msg.content).split("DELEGATED_TO_HUMAN: ")[-1]
                    break
            
            return {"messages": new_msgs, "delegation_reason": delegation_reason}

        async def delegator_node(state: AgentState):
            plan = state.get("plan", [])
            delegation_reason = state.get("delegation_reason", "No specific reason provided.")
            
            plan_text = "\\n".join([f"- {step}" for step in plan])
            
            final_msg = AIMessage(
                content=(
                    "DELEGATED_TO_HUMAN: I need your help to continue.\\n\\n"
                    f"**Delegation Reason/Analysis:**\\n{delegation_reason}\\n\\n"
                    f"**My Plan Was:**\\n{plan_text}\\n\\n"
                    "Please provide the requested information or perform the required action, then let me know."
                )
            )
            return {"messages": [final_msg]}

        def should_delegate(state: AgentState) -> str:
            if state.get("delegation_reason"):
                return "delegator"
            return "__end__"

        workflow = StateGraph(AgentState)
        workflow.add_node("planner", planner_node)
        workflow.add_node("executor", executor_node)
        workflow.add_node("delegator", delegator_node)

        workflow.add_edge(START, "planner")
        workflow.add_edge("planner", "executor")
        workflow.add_conditional_edges("executor", should_delegate, {"delegator": "delegator", "__end__": END})
        workflow.add_edge("delegator", END)

        self.graph = workflow.compile(checkpointer=self.checkpointer)

    def bind_tools(self, tools: List):
        """
        Binds tools to the agent and re-initializes it.
        """
        self.tools = tools
        self._initialize_agent()

    def _ensure_config(self, config, user_id=None):
        """Ensures that the config has a thread_id based on session_id/user_id."""
        config = config or {}
        if "configurable" not in config:
            config["configurable"] = {}
            
        # Map session_id to thread_id if present (LangServe standard)
        if "session_id" in config["configurable"]:
             config["configurable"]["thread_id"] = config["configurable"]["session_id"]
        
        # Or use provided user_id
        if "thread_id" not in config["configurable"]:
            config["configurable"]["thread_id"] = user_id or "default_playground_thread"
            
        # Add callbacks for logging
        if "callbacks" not in config:
            config["callbacks"] = self.callbacks
            
        return config



    def _sanitize_input(self, input):
        """
        Sanitizes the input logic to ensure 'messages' key exists.
        Fixes issue where LangServe/Playground sends 'undefined' key.
        """
        from langchain_core.messages import convert_to_messages, HumanMessage
        
        if isinstance(input, dict):
            # Fix 'undefined' key issue seen in logs
            if "undefined" in input:
                input["messages"] = input.pop("undefined")
            
            # Fallback: if 'messages' missing but 'input' exists and is a list
            if "messages" not in input and "input" in input:
                val = input["input"]
                if isinstance(val, list):
                    input["messages"] = val
                elif isinstance(val, str):
                    input["messages"] = [HumanMessage(content=val)]
            
            # Convert to message objects (Critical for Tracers)
            if "messages" in input:
                input["messages"] = convert_to_messages(input["messages"])
            
        return input

    def _extract_output(self, result):
        """Extracts the last message content from the graph result."""
        # Result is correct AIMessage or string?
        # Graph returns state dict usually.
        if isinstance(result, dict) and "messages" in result:
             last_msg = result["messages"][-1]
             # Return the message object itself so it has .type for tracers
             return last_msg
        return result

    # Runnable Interface Implementation
    def invoke(self, input, config=None, **kwargs):
        input = self._sanitize_input(input)
        config = self._ensure_config(config)
        result = self.graph.invoke(input, config, **kwargs)
        return self._extract_output(result)

    async def ainvoke(self, input, config=None, **kwargs):
        import logging
        logger = logging.getLogger("src.infrastructure.out_adapters.ai.langgraph_agent_adapter")
        logger.info(f"AI Agent ainvoke | Input: {input}")
        input = self._sanitize_input(input)
        config = self._ensure_config(config)
        result = await self.graph.ainvoke(input, config, **kwargs)
        output = self._extract_output(result)
        logger.info(f"AI Agent ainvoke | Output type: {type(output)}")
        if hasattr(output, "content"):
            logger.info(f"AI Agent ainvoke | Output content: {output.content[:50]}...")
        return output

    def stream(self, input, config=None, **kwargs):
        input = self._sanitize_input(input)
        config = self._ensure_config(config)
        # Fallback to invoke to ensure stability for now.
        # Yield the extracted message.
        result = self.graph.invoke(input, config, **kwargs)
        yield self._extract_output(result)

    async def astream(self, input, config=None, **kwargs):
        import logging
        logger = logging.getLogger("src.infrastructure.out_adapters.ai.langgraph_agent_adapter")
        logger.info(f"AI Agent astream | Input: {input}")
        input = self._sanitize_input(input)
        config = self._ensure_config(config)
        # Fallback to ainvoke for stability.
        result = await self.graph.ainvoke(input, config, **kwargs)
        output = self._extract_output(result)
        logger.info(f"AI Agent astream | Yielding: {output}")
        yield output

    def batch(self, inputs, config=None, **kwargs):

        inputs = [self._sanitize_input(i) for i in inputs]
        config = self._ensure_config(config)
        results = self.graph.batch(inputs, config, **kwargs)
        return [self._extract_output(r) for r in results]

    async def abatch(self, inputs, config=None, **kwargs):
        inputs = [self._sanitize_input(i) for i in inputs]
        config = self._ensure_config(config)
        return await self.graph.abatch(inputs, config, **kwargs)

    async def ask(self, prompt: str, user_id: str | None = None) -> str:
        """
        Sends a prompt to the agent and returns the final response.
        Uses user_id as thread_id to maintain session history.
        """
        if not self.graph:
             response = await self.llm.ainvoke(prompt)
             return response.content

        config = self._ensure_config(None, user_id=user_id)
        
        result = await self.graph.ainvoke(
            {"messages": [HumanMessage(content=prompt)]},
            config=config
        )
        
        # Extract the last message content from the state dict
        if isinstance(result, dict) and "messages" in result:
             messages = result["messages"]
             
             # Search backwards for a delegation in the current turn
             # We stop if we see a HumanMessage (which started this turn)
             for msg in reversed(messages):
                 if getattr(msg, "type", "") == "human":
                     break
                 if hasattr(msg, "content") and "DELEGATED_TO_HUMAN:" in str(msg.content):
                     return str(msg.content)

             last_msg = messages[-1]
             if hasattr(last_msg, "content"):
                 return last_msg.content
             return str(last_msg)
             
        return str(result)

    async def generate_text(self, prompt: str, model_name: Optional[str] = None, json_mode: bool = False, temperature: float = 0.4) -> str:
        # Delegate to the underlying LLM
        response = await self.llm.ainvoke(prompt, temperature=temperature)
        return response.content

    async def generate_vision(self, prompt: str, images: List[Dict[str, Any]], model_name: Optional[str] = None, json_mode: bool = False, expected_schema: Optional[Dict[str, Any]] = None) -> str:
        raise NotImplementedError("LangGraphAgentAdapter does not support raw vision calls. Use GeminiAdapter instead.")

    async def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", prompt: str = "") -> str:
        raise NotImplementedError("LangGraphAgentAdapter does not support raw transcription calls. Use GeminiAdapter instead.")
