from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any, Union

class AIPort(ABC):
    @abstractmethod
    async def ask(self, prompt: str, user_id: str | None = None) -> str:
        """Sends a prompt to the AI and returns the response."""
        pass

    @abstractmethod
    async def generate_text(self, prompt: str, model_name: Optional[str] = None, json_mode: bool = False, temperature: float = 0.4) -> str:
        """Generates text based on a prompt."""
        pass

    @abstractmethod
    async def generate_vision(self, prompt: str, images: List[Dict[str, Any]], model_name: Optional[str] = None, json_mode: bool = False, expected_schema: Optional[Dict[str, Any]] = None) -> str:
        """Analyzes images based on a prompt."""
        pass

    @abstractmethod
    async def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", prompt: str = "") -> str:
        """Transcribes audio content."""
        pass
