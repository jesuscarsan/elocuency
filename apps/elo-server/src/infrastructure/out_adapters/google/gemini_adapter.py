import google.generativeai as genai
import base64
from typing import List, Optional, Dict, Any
from src.domain.ports.ai_port import AIPort
from src.infrastructure.logging.prompt_logger import prompt_logger

class GeminiAdapter(AIPort):
    def __init__(self, api_key: str, default_model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.default_model = default_model
        if self.api_key:
            genai.configure(api_key=self.api_key)

    async def ask(self, prompt: str, user_id: str | None = None) -> str:
        # Simple ask implementation
        return await self.generate_text(prompt)

    async def generate_text(self, prompt: str, model_name: Optional[str] = None, json_mode: bool = False, temperature: float = 0.4) -> str:
        model = genai.GenerativeModel(model_name or self.default_model)
        generation_config = genai.types.GenerationConfig(temperature=temperature)
        
        if json_mode:
            generation_config.response_mime_type = "application/json"
            
        response = await model.generate_content_async(
            contents=[prompt],
            generation_config=generation_config
        )
        result = response.text
        prompt_logger.log_interaction("google", prompt, result)
        return result

    async def generate_vision(self, prompt: str, images: List[Dict[str, Any]], model_name: Optional[str] = None, json_mode: bool = False, expected_schema: Optional[Dict[str, Any]] = None) -> str:
        model = genai.GenerativeModel(model_name or self.default_model)
        
        contents = [prompt]
        for img in images:
            contents.append({
                "mime_type": img["mime_type"],
                "data": base64.b64decode(img["data"])
            })
            
        generation_config = genai.types.GenerationConfig()
        if json_mode:
            generation_config.response_mime_type = "application/json"
            if expected_schema:
                generation_config.response_schema = expected_schema
             
        response = await model.generate_content_async(
            contents=contents,
            generation_config=generation_config
        )
        result = response.text
        prompt_logger.log_interaction("google", f"[Vision] {prompt}", result)
        return result

    async def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", prompt: str = "") -> str:
        model = genai.GenerativeModel("gemini-1.5-flash-8b")
        contents = [
            prompt,
            {
                "mime_type": mime_type,
                "data": base64.b64decode(audio_base64)
            }
        ]
        response = await model.generate_content_async(contents=contents)
        result = response.text
        prompt_logger.log_interaction("google", f"[Audio] {prompt}", result)
        return result
