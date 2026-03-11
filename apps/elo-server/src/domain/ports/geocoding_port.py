from abc import ABC, abstractmethod
from typing import Optional, List
from pydantic import BaseModel


class GeocodingResult(BaseModel):
    name: str = ""
    neighborhood: str = ""
    city: str = ""
    province: str = ""
    region: str = ""
    country: str = ""
    google_place_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    formatted_address: Optional[str] = None


class GeocodingPort(ABC):
    @abstractmethod
    async def geocode(
        self,
        place_name: str,
        place_id: Optional[str] = None,
        language: str = "es",
    ) -> List[GeocodingResult]:
        """
        Geocodes a place by name or ID.
        Returns a list of results for disambiguation.
        """
        pass
