import httpx
from typing import List
from src.domain.ports.image_search_port import ImageSearchPort

class GoogleSearchAdapter(ImageSearchPort):
    def __init__(self, api_key: str, search_engine_id: str):
        self.api_key = api_key
        self.search_engine_id = search_engine_id

    async def search_images(self, query: str, count: int = 10) -> List[str]:
        if not self.api_key or not self.search_engine_id:
            raise ValueError("Google API Key or Search Engine ID is not configured.")
            
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "q": query,
            "cx": self.search_engine_id,
            "key": self.api_key,
            "searchType": "image",
            "num": min(10, count)
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            items = data.get("items", [])
            return [item["link"] for item in items if "link" in item]
