import os
import json
import logging
import httpx
from typing import List, Optional
from src.domain.ports.n8n_port import N8nPort
from src.infrastructure.config import N8nConfig

logger = logging.getLogger(__name__)

class N8nAdapter(N8nPort):
    def __init__(self, config: N8nConfig):
        self.config = config
        self.client = httpx.Client(
            base_url=config.base_url,
            timeout=10.0
        )
        # Ensure directory exists if we are in a writable environment
        if not os.path.exists(config.workflows_dir):
            try:
                os.makedirs(config.workflows_dir, exist_ok=True)
            except Exception as e:
                logger.warning(f"Could not create workflows directory {config.workflows_dir}: {e}")

    def trigger_workflow(self, workflow_name: str, data: dict) -> str:
        """
        Triggers an n8n workflow by name by finding its webhook path in the JSON file.
        """
        try:
            # 1. Find the workflow file
            filename = f"{workflow_name}.json"
            filepath = os.path.join(self.config.workflows_dir, filename)
            
            if not os.path.exists(filepath):
                # Try searching for it (case insensitive)
                if not os.path.exists(self.config.workflows_dir):
                    return f"Error: Workflows directory '{self.config.workflows_dir}' not found."
                    
                all_files = os.listdir(self.config.workflows_dir)
                found = False
                for f in all_files:
                    if f.lower() == filename.lower():
                        filepath = os.path.join(self.config.workflows_dir, f)
                        found = True
                        break
                if not found:
                    return f"Error: Workflow '{workflow_name}' not found in {self.config.workflows_dir}."

            # 2. Extract Webhook URL
            with open(filepath, 'r') as f:
                workflow_data = json.load(f)
                
            webhook_path = None
            for node in workflow_data.get('nodes', []):
                if node.get('type') in ['n8n-nodes-base.webhook', 'n8n-nodes-base.webhookPublic']:
                    webhook_path = node.get('parameters', {}).get('path')
                    break
            
            if not webhook_path:
                 return f"Error: Workflow '{workflow_name}' has no Webhook node."

            # 3. Call the webhook
            url = f"/webhook/{webhook_path}"
            response = self.client.post(url, json=data)
            
            if response.status_code == 200:
                return f"Success: Workflow '{workflow_name}' triggered. Response: {response.text}"
            else:
                return f"Error: Failed to trigger workflow. Status: {response.status_code}, Response: {response.text}"

        except httpx.ConnectError:
            return f"Error: Could not connect to n8n at {self.config.base_url}. Ensure the service is running."
        except Exception as e:
            logger.error(f"Error triggering n8n workflow: {e}")
            return f"Error: {str(e)}"

    def list_workflows(self) -> List[str]:
        """Lists all n8n workflows available in the flat-file storage."""
        try:
            if not os.path.exists(self.config.workflows_dir):
                logger.warning(f"Workflows directory '{self.config.workflows_dir}' not found.")
                return []
                
            files = [f.replace('.json', '') for f in os.listdir(self.config.workflows_dir) if f.endswith('.json')]
            return files
        except Exception as e:
            logger.error(f"Error listing n8n workflows: {e}")
            return []

    def create_workflow(self, workflow_name: str, workflow_json: str) -> str:
        """Creates a new n8n workflow file."""
        try:
            if not os.path.exists(self.config.workflows_dir):
                os.makedirs(self.config.workflows_dir, exist_ok=True)
                
            filename = workflow_name if workflow_name.endswith(".json") else f"{workflow_name}.json"
            filepath = os.path.join(self.config.workflows_dir, filename)
            
            # Verify JSON
            json_obj = json.loads(workflow_json)
            
            with open(filepath, 'w') as f:
                json.dump(json_obj, f, indent=2)
                
            return f"Success: Workflow '{workflow_name}' created at {filepath}."
        except Exception as e:
            logger.error(f"Error creating n8n workflow: {e}")
            return f"Error creating workflow: {str(e)}"
