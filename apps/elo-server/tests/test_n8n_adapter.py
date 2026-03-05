import os
import sys

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from infrastructure.config import N8nConfig
from infrastructure.out_adapters.n8n.n8n_adapter import N8nAdapter
import json

def test_n8n_adapter_listing():
    print("Testing N8nAdapter listing...")
    # Mocking config
    workspace_path = "/Users/joshua/my-docs/code/elo-workbench/elo-workspace"
    workflows_dir = os.path.join(workspace_path, "n8n", "workflows")
    
    config = N8nConfig(
        base_url="http://localhost:5678",
        workflows_dir=workflows_dir
    )
    
    adapter = N8nAdapter(config)
    
    # 1. Test List
    workflows = adapter.list_workflows()
    print(f"Workflows found: {workflows}")
    
    # 2. Test Create (Mock)
    if not workflows:
        print("Creating mock workflow for test...")
        mock_wf = {
            "nodes": [
                {
                    "parameters": {"path": "test-webhook"},
                    "type": "n8n-nodes-base.webhook",
                    "name": "Webhook"
                }
            ]
        }
        res = adapter.create_workflow("test_workflow", json.dumps(mock_wf))
        print(res)
        
        # Test List again
        workflows = adapter.list_workflows()
        print(f"Workflows found after creation: {workflows}")

if __name__ == "__main__":
    test_n8n_adapter_listing()
