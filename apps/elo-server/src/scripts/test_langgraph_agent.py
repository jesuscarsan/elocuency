import asyncio
import sys
import os

# Add the project root to the python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from src.infrastructure.config import load_config
from src.infrastructure.out_adapters.ai.langgraph_agent_adapter import LangGraphAgentAdapter
from src.infrastructure.mcp.manager import MCPManager

async def test_langgraph_agent():
    print("Loading config...")
    config = load_config()
    
    print("Initializing MCP Manager...")
    mcp_manager = MCPManager()
    
    print("Starting MCP Manager...")
    await mcp_manager.start()
    
    try:
        print("Fetching tools...")
        tools = await mcp_manager.get_tools()
        
        print(f"Initializing LangGraph Agent with {len(tools)} tools...")
        ai_adapter = LangGraphAgentAdapter(
            api_key=config.ai.api_key,
            model_name=config.ai.model,
            tools=tools
        )
        
        prompt = "Hello! Who are you and what tools do you have available?"
        print(f"\nPrompt: {prompt}")
        response = await ai_adapter.ask(prompt)
        print(f"Response: {response}")
        
        if tools:
            # Try a prompt that should trigger a tool
            tool_prompt = "List notes in the root directory of my vault"
            print(f"\nPrompt: {tool_prompt}")
            response = await ai_adapter.ask(tool_prompt)
            print(f"Response: {response}")
        else:
            print("\nSkipping tool-specific test as no tools were found.")
            
    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\nStopping MCP Manager...")
        await mcp_manager.stop()

if __name__ == "__main__":
    asyncio.run(test_langgraph_agent())
