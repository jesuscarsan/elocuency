import os
import datetime
import json
from src.infrastructure.config import load_config

class PromptLogger:
    def __init__(self):
        self.config = load_config()
        self.log_dir = os.path.join(self.config.paths.workspace, "logs")
        os.makedirs(self.log_dir, exist_ok=True)

    def log_interaction(self, provider: str, prompt: str, response: any):
        """
        Logs an AI interaction to a provider-specific file with daily partitioning.
        Format: <provider>-prompts.log.YYYY-MM-DD
        """
        date_suffix = datetime.datetime.now().strftime("%Y-%m-%d")
        log_file = os.path.join(self.log_dir, f"{provider.lower()}-prompts.log.{date_suffix}")
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Try to serialize response if it's not a string
        if not isinstance(response, str):
            try:
                if hasattr(response, "dict"):
                    response_data = response.dict()
                elif hasattr(response, "content"):
                    response_data = response.content
                else:
                    response_data = str(response)
            except Exception:
                response_data = str(response)
        else:
            response_data = response

        log_entry = {
            "timestamp": timestamp,
            "prompt": prompt,
            "response": response_data
        }

        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")

# Global instance
prompt_logger = PromptLogger()
