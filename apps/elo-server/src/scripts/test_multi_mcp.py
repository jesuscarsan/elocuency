import asyncio
import sys
import os

# Add the project root to the python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from src.infrastructure.config import load_config
from src.infrastructure.out_adapters.ai.langgraph_agent_adapter import LangGraphAgentAdapter
from src.infrastructure.mcp.manager import MCPManager

async def test_multi_mcp():
    print("Loading config...")
    config = load_config()
    
    print("Initializing MCP Manager...")
    mcp_manager = MCPManager()
    
    print("Starting MCP Manager...")
    await mcp_manager.start()
    
    try:
        print("Fetching tools...")
        tools = await mcp_manager.get_tools()
        print(f"Total tools found: {len(tools)}")
        
        # Look for filesystem tools
        fs_tools = [t.name for t in tools if 'filesystem' in t.name]
        print(f"Filesystem tools found: {len(fs_tools)}")
        print(f"Sample filesystem tools: {fs_tools[:5]}")
        
        obs_tools = [t.name for t in tools if 'obsidian' in t.name]
        print(f"Obsidian tools found: {len(obs_tools)}")
        print(f"Sample obsidian tools: {obs_tools[:5]}")
        
        print("\nInitializing LangGraph Agent...")
        ai_adapter = LangGraphAgentAdapter(
            api_key=config.ai.api_key,
            model_name=config.ai.model,
            tools=tools
        )
        
        # Test filesystem access
        prompt = "List the files in the current project directory (elo-server)"
        print(f"\nPrompt: {prompt}")
        response = await ai_adapter.ask(prompt)
        print(f"Response: {response}")
        
        # Test Obsidian access in the same prompt or next
        prompt_obsidian = "How many notes do I have in my Obsidian vault? Use your vault statistics tool."
        print(f"\nPrompt: {prompt_obsidian}")
        response_obsidian = await ai_adapter.ask(prompt_obsidian)
        print(f"Response: {response_obsidian}")
            
    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\nStopping MCP Manager...")
        await mcp_manager.stop()

if __name__ == "__main__":
    asyncio.run(test_multi_mcp())
