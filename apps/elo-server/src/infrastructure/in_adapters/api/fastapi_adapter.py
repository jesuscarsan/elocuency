from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.application.use_cases.ask_ai_use_case import AskAIUseCase
from src.infrastructure.in_adapters.api.auth import verify_token

class AskRequest(BaseModel):
    prompt: str
    user_id: str | None = None

class AskResponse(BaseModel):
    response: str

from typing import Callable, AsyncContextManager
import os
import shutil
import json
from src.infrastructure.config import AppConfig

class InitVaultRequest(BaseModel):
    language: str

class InitVaultResponse(BaseModel):
    message: str
    target_path: str

def create_app(ask_ai_use_case: AskAIUseCase, config: AppConfig, lifespan: Callable[[FastAPI], AsyncContextManager[None]] = None) -> FastAPI:
    app = FastAPI(title="Elo Server API", lifespan=lifespan)

    from src.infrastructure.in_adapters.api.ai_router import router as ai_router
    from src.infrastructure.in_adapters.api.geocoding_router import router as geocoding_router

    # Enable CORS for LangServe Playground
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(ai_router)
    app.include_router(geocoding_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/api/config", dependencies=[Depends(verify_token)])
    async def get_config():
        return {"user": config.user.model_dump(), "obsidian": config.obsidian.model_dump()}

    @app.get("/api/config/json", dependencies=[Depends(verify_token)])
    async def get_config_json():
        if not config.config_file_path or not os.path.exists(config.config_file_path):
            raise HTTPException(status_code=404, detail="Config file not found on server.")
        
        try:
            with open(config.config_file_path, "r") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read config file: {e}")

    @app.post("/api/vault/init", response_model=InitVaultResponse, dependencies=[Depends(verify_token)])
    async def init_vault(request: InitVaultRequest):
        if not config.obsidian.vault_path:
            raise HTTPException(status_code=400, detail="VAULT_PATH is not configured in elapsed environment.")
            
        lang = request.language if request.language in ["es", "en"] else "es"
        source_dir = os.path.join(config.paths.assets, "vault-init", f"{lang}-metadata")
        
        if not os.path.exists(source_dir):
            raise HTTPException(status_code=404, detail=f"Vault templates for language '{lang}' not found at {source_dir}.")
            
        target_metadata_dir = os.path.join(config.obsidian.vault_path, "!!metadata")
        
        try:
            # Copy all contents from source_dir over to vault_path/!!metadata
            # dirs_exist_ok=True allows merging into an existing !!metadata without crashing
            shutil.copytree(source_dir, target_metadata_dir, dirs_exist_ok=True)
            return InitVaultResponse(message=f"Vault successfully initialized with '{lang}' templates.", target_path=target_metadata_dir)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize vault: {e}")

    @app.post("/ask", response_model=AskResponse, dependencies=[Depends(verify_token)])
    async def ask(request: AskRequest):
        try:
            ai_response = await ask_ai_use_case.execute(request.prompt, user_id=request.user_id)
            return AskResponse(response=ai_response)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail="Internal server error")

    return app
