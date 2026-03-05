from typing import Any, Dict, List, Optional, Union
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult
from src.infrastructure.logging.prompt_logger import prompt_logger

class PromptLoggingCallbackHandler(BaseCallbackHandler):
    """
    A LangChain callback handler that logs prompts and responses to a file.
    """
    def __init__(self, provider: str = "google"):
        self.provider = provider
        self.current_prompt = None

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> Any:
        # For ChatModels, prompts might be empty, check messages instead
        if prompts:
            self.current_prompt = prompts[0]

    def on_chat_model_start(
        self, serialized: Dict[str, Any], messages: List[List[BaseMessage]], **kwargs: Any
    ) -> Any:
        # Capture the last message or the whole conversation as prompt
        if messages and messages[0]:
            # Simple representation of the messages for the log
            self.current_prompt = "\n".join([f"{m.type}: {m.content}" for m in messages[0]])

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> Any:
        if response.generations and response.generations[0]:
            llm_output = response.generations[0][0].text
            prompt_logger.log_interaction(self.provider, self.current_prompt, llm_output)

    def on_llm_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> Any:
        prompt_logger.log_interaction(self.provider, self.current_prompt, f"ERROR: {str(error)}")
