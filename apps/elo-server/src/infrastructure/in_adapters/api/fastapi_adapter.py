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

def create_app(ask_ai_use_case: AskAIUseCase, lifespan: Callable[[FastAPI], AsyncContextManager[None]] = None) -> FastAPI:
    app = FastAPI(title="Elo Server API", lifespan=lifespan)

    from src.infrastructure.in_adapters.api.ai_router import router as ai_router

    # Enable CORS for LangServe Playground
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(ai_router)

    @app.get("/health")
# ... rest of file ...
    async def health():
        return {"status": "ok"}

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
