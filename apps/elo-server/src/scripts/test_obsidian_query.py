import os
import sys
from dotenv import load_dotenv

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from src.infrastructure.config import load_config
from src.infrastructure.out_adapters.obsidian.langchain_obsidian_adapter import LangChainObsidianAdapter
from src.application.use_cases.query_vault_use_case import QueryVaultUseCase

def main():
    load_dotenv()
    config = load_config()
    
    # Configuration
    VAULT_PATH = config.obsidian.vault_path
    PERSIST_DIRECTORY = config.obsidian.persist_directory
    AI_API_KEY = config.ai.api_key
    
    if not AI_API_KEY:
        print("Error: GOOGLE_AI_API_KEY not found in config or .env")
        return

    print(f"Initializing Obsidian Adapter for vault: {VAULT_PATH}")
    print(f"Using persistence directory: {PERSIST_DIRECTORY}")
    adapter = LangChainObsidianAdapter(
        vault_path=VAULT_PATH,
        google_api_key=AI_API_KEY,
        persist_directory=PERSIST_DIRECTORY
    )
    
    use_case = QueryVaultUseCase(adapter)
    
    # Test query
    while True:
        question = input("\nPregunta sobre tu Vault (o 'salir'): ")
        if question.lower() in ['salir', 'exit', 'quit']:
            break
            
        print("Buscando respuesta...")
        try:
            answer = use_case.execute(question)
            print(f"\nRespuesta: {answer}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()
