from abc import ABC, abstractmethod
from typing import List

class ImageSearchPort(ABC):
    @abstractmethod
    async def search_images(self, query: str, count: int = 10) -> List[str]:
        """
        Searches for images and returns a list of URLs.
        """
        pass
