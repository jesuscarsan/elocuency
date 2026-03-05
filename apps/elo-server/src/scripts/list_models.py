import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_AI_API_KEY", os.getenv("GOOGLE_API_KEY"))
if not api_key:
    # Try looking in config.yaml if not in env
    import yaml
    try:
        with open("../../workspace/config.yaml", "r") as f:
            config = yaml.safe_load(f)
            api_key = config.get("ai", {}).get("api_key")
    except Exception as e:
        print(f"Could not load config: {e}")

if not api_key:
    print("No API key found.")
    exit(1)

genai.configure(api_key=api_key)

print("Listing available models...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")
