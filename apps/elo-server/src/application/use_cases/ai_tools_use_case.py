from typing import List, Optional, Dict, Any
from src.domain.ports.ai_port import AIPort
from src.domain.ports.image_search_port import ImageSearchPort
from pydantic import BaseModel

class ImageContent(BaseModel):
    data: str  # base64 string
    mime_type: str

class AIToolsUseCase:
    def __init__(self, ai_provider: AIPort, search_provider: ImageSearchPort):
        self.ai_provider = ai_provider
        self.search_provider = search_provider

    async def generate_text(self, prompt: str, model_name: Optional[str] = None, json_mode: bool = False, temperature: float = 0.4) -> str:
        return await self.ai_provider.generate_text(
            prompt=prompt,
            model_name=model_name,
            json_mode=json_mode,
            temperature=temperature
        )

    async def generate_vision(self, prompt: str, images: List[ImageContent], model_name: Optional[str] = None, json_mode: bool = False, expected_schema: Optional[Dict[str, Any]] = None) -> str:
        # Convert Pydantic models to dicts for the port
        image_dicts = [{"data": img.data, "mime_type": img.mime_type} for img in images]
        return await self.ai_provider.generate_vision(
            prompt=prompt,
            images=image_dicts,
            model_name=model_name,
            json_mode=json_mode,
            expected_schema=expected_schema
        )

    async def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", prompt: str = "") -> str:
        return await self.ai_provider.transcribe_audio(
            audio_base64=audio_base64,
            mime_type=mime_type,
            prompt=prompt
        )

    async def search_images(self, query: str, count: int = 10) -> List[str]:
        return await self.search_provider.search_images(
            query=query,
            count=count
        )
