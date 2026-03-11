from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from src.domain.ports.geocoding_port import GeocodingPort, GeocodingResult
from src.infrastructure.in_adapters.api.auth import verify_token

router = APIRouter(prefix="/api", tags=["Geocoding"])


class GeocodeRequest(BaseModel):
    place_name: str = ""
    place_id: Optional[str] = None
    language: str = "es"


class GeocodeResponse(BaseModel):
    results: List[GeocodingResult]


def get_geocoding_port(request: Request) -> GeocodingPort:
    return request.app.state.geocoding_port


@router.post("/geocode", response_model=GeocodeResponse, dependencies=[Depends(verify_token)])
async def geocode(request: GeocodeRequest, geocoding: GeocodingPort = Depends(get_geocoding_port)):
    try:
        results = await geocoding.geocode(
            place_name=request.place_name,
            place_id=request.place_id,
            language=request.language,
        )
        return GeocodeResponse(results=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
