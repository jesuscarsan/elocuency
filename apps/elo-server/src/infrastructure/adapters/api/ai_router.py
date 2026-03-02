from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from src.application.use_cases.ai_tools_use_case import AIToolsUseCase, ImageContent
from src.infrastructure.adapters.api.auth import verify_token

router = APIRouter(prefix="/api/ai", tags=["AI Tools"])

# --- Models ---
class GenerateRequest(BaseModel):
    prompt: str
    model_name: Optional[str] = None
    json_mode: bool = False
    temperature: float = 0.4

class GenerateResponse(BaseModel):
    response: str

class VisionRequest(BaseModel):
    prompt: str
    images: List[ImageContent]
    model_name: Optional[str] = None
    json_mode: bool = False
    expected_schema: Optional[Dict[str, Any]] = None

class VisionResponse(BaseModel):
    response: str

class TranscribeRequest(BaseModel):
    audio_base64: str
    mime_type: str = "audio/webm"
    prompt: str = ""

class TranscribeResponse(BaseModel):
    transcription: str

class ImageSearchRequest(BaseModel):
    query: str
    count: int = 10

class ImageSearchResponse(BaseModel):
    images: List[str]

# --- Dependencies ---
# Assume ai_use_case is injected into app state during bootstrap
def get_ai_use_case(request: Request) -> AIToolsUseCase:
    return request.app.state.ai_tools_use_case

# --- Endpoints ---
@router.post("/generate", response_model=GenerateResponse, dependencies=[Depends(verify_token)])
async def generate(request: GenerateRequest, use_case: AIToolsUseCase = Depends(get_ai_use_case)):
    try:
        text = await use_case.generate_text(
            prompt=request.prompt,
            model_name=request.model_name,
            json_mode=request.json_mode,
            temperature=request.temperature
        )
        return GenerateResponse(response=text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/vision", response_model=VisionResponse, dependencies=[Depends(verify_token)])
async def vision(request: VisionRequest, use_case: AIToolsUseCase = Depends(get_ai_use_case)):
    try:
        text = await use_case.generate_vision(
            prompt=request.prompt,
            images=request.images,
            model_name=request.model_name,
            json_mode=request.json_mode,
            expected_schema=request.expected_schema
        )
        return VisionResponse(response=text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe", response_model=TranscribeResponse, dependencies=[Depends(verify_token)])
async def transcribe(request: TranscribeRequest, use_case: AIToolsUseCase = Depends(get_ai_use_case)):
    try:
        text = await use_case.transcribe_audio(
            audio_base64=request.audio_base64,
            mime_type=request.mime_type,
            prompt=request.prompt
        )
        return TranscribeResponse(transcription=text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/image-search", response_model=ImageSearchResponse, dependencies=[Depends(verify_token)])
async def image_search(request: ImageSearchRequest, use_case: AIToolsUseCase = Depends(get_ai_use_case)):
    try:
        images = await use_case.search_images(
            query=request.query,
            count=request.count
        )
        return ImageSearchResponse(images=images)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
