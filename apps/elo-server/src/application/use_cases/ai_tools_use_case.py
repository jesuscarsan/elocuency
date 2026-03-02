import google.generativeai as genai
from typing import List, Optional, Dict, Any, Union
import json
import base64
import httpx
from pydantic import BaseModel

class ImageContent(BaseModel):
    data: str  # base64 string
    mime_type: str

class AIToolsUseCase:
    def __init__(self, api_key: str, default_model: str = "gemini-2.5-flash", search_engine_id: Optional[str] = None):
        self.api_key = api_key
        self.default_model = default_model
        self.search_engine_id = search_engine_id
        if self.api_key:
            genai.configure(api_key=self.api_key)

    async def generate_text(self, prompt: str, model_name: Optional[str] = None, json_mode: bool = False, temperature: float = 0.4) -> str:
        if not self.api_key:
            raise ValueError("Google API Key is not configured.")
        
        model = genai.GenerativeModel(model_name or self.default_model)
        generation_config = genai.types.GenerationConfig(temperature=temperature)
        
        if json_mode:
            generation_config.response_mime_type = "application/json"
            
        response = await model.generate_content_async(
            contents=[prompt],
            generation_config=generation_config
        )
        return response.text

    async def generate_vision(self, prompt: str, images: List[ImageContent], model_name: Optional[str] = None, json_mode: bool = False, expected_schema: Optional[Dict[str, Any]] = None) -> str:
        if not self.api_key:
            raise ValueError("Google API Key is not configured.")
            
        model = genai.GenerativeModel(model_name or self.default_model)
        
        contents = [prompt]
        for img in images:
            # According to Gemini API, inline data images
            contents.append({
                "mime_type": img.mime_type,
                "data": base64.b64decode(img.data)
            })
            
        generation_config = genai.types.GenerationConfig()
        if json_mode:
            generation_config.response_mime_type = "application/json"
        
        # Note: If passing exact schema is needed via SDK, it might need different syntax. 
        # Typically, a strong prompt + JSON mode is enough. We can pass response_schema if supported by the SDK version.
        if expected_schema:
             generation_config.response_schema = expected_schema
             
        response = await model.generate_content_async(
            contents=contents,
            generation_config=generation_config
        )
        return response.text

    async def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", prompt: str = "") -> str:
        if not self.api_key:
            raise ValueError("Google API Key is not configured.")
            
        # Using Gemini 1.5/2.0 Audio capabilities
        model = genai.GenerativeModel("gemini-1.5-flash-8b") # or another fast model supporting audio
        
        contents = [
            prompt,
            {
                "mime_type": mime_type,
                "data": base64.b64decode(audio_base64)
            }
        ]
        response = await model.generate_content_async(contents=contents)
        return response.text

    async def search_images(self, query: str, count: int = 10) -> List[str]:
        if not self.api_key or not self.search_engine_id:
            raise ValueError("Google API Key or Search Engine ID is not configured for Image Search.")
            
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "q": query,
            "cx": self.search_engine_id,
            "key": self.api_key,
            "searchType": "image",
            "num": min(10, count) # max 10 allowed by Google Custom Search API per request
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            items = data.get("items", [])
            return [item["link"] for item in items if "link" in item]
