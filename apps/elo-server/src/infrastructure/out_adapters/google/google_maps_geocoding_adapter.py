import re
import httpx
import logging
from typing import Optional, List

from src.domain.ports.geocoding_port import GeocodingPort, GeocodingResult

logger = logging.getLogger(__name__)

LOG_PREFIX = "[GoogleMapsGeocodingAdapter]"

# Spanish province-to-region mapping
PROVINCE_TO_REGION: dict[str, str] = {
    "Alava": "País Vasco", "Álava": "País Vasco", "Araba": "País Vasco",
    "Albacete": "Castilla-La Mancha",
    "Alicante": "Comunitat Valenciana", "Alacant": "Comunitat Valenciana",
    "Almería": "Andalucía",
    "Asturias": "Principado de Asturias",
    "Avila": "Castilla y León", "Ávila": "Castilla y León",
    "Badajoz": "Extremadura",
    "Baleares": "Illes Balears", "Illes Balears": "Illes Balears",
    "Barcelona": "Cataluña",
    "Burgos": "Castilla y León",
    "Caceres": "Extremadura", "Cáceres": "Extremadura",
    "Cadiz": "Andalucía", "Cádiz": "Andalucía",
    "Cantabria": "Cantabria",
    "Castellon": "Comunitat Valenciana", "Castellón": "Comunitat Valenciana", "Castelló": "Comunitat Valenciana",
    "Ceuta": "Ceuta",
    "Ciudad Real": "Castilla-La Mancha",
    "Cordoba": "Andalucía", "Córdoba": "Andalucía",
    "Cuenca": "Castilla-La Mancha",
    "Gerona": "Cataluña", "Girona": "Cataluña",
    "Granada": "Andalucía",
    "Guadalajara": "Castilla-La Mancha",
    "Guipuzcoa": "País Vasco", "Guipúzcoa": "País Vasco", "Gipuzkoa": "País Vasco",
    "Huelva": "Andalucía",
    "Huesca": "Aragón",
    "Jaen": "Andalucía", "Jaén": "Andalucía",
    "La Coruña": "Galicia", "A Coruña": "Galicia",
    "La Rioja": "La Rioja",
    "Las Palmas": "Canarias",
    "Leon": "Castilla y León", "León": "Castilla y León",
    "Lerida": "Cataluña", "Lérida": "Cataluña", "Lleida": "Cataluña",
    "Lugo": "Galicia",
    "Madrid": "Comunidad de Madrid",
    "Malaga": "Andalucía", "Málaga": "Andalucía",
    "Melilla": "Melilla",
    "Murcia": "Región de Murcia",
    "Navarra": "Comunidad Foral de Navarra",
    "Orense": "Galicia", "Ourense": "Galicia",
    "Palencia": "Castilla y León",
    "Pontevedra": "Galicia",
    "Salamanca": "Castilla y León",
    "Santa Cruz de Tenerife": "Canarias",
    "Segovia": "Castilla y León",
    "Sevilla": "Andalucía",
    "Soria": "Castilla y León",
    "Tarragona": "Cataluña",
    "Teruel": "Aragón",
    "Toledo": "Castilla-La Mancha",
    "Valencia": "Comunitat Valenciana", "València": "Comunitat Valenciana",
    "Valladolid": "Castilla y León",
    "Vizcaya": "País Vasco", "Bizkaia": "País Vasco",
    "Zamora": "Castilla y León",
    "Zaragoza": "Aragón",
}

HEX_CID_PATTERN = re.compile(r"^0x[a-fA-F0-9]+:0x[a-fA-F0-9]+$")


class GoogleMapsGeocodingAdapter(GeocodingPort):
    """Implements GeocodingPort using the Google Maps Geocoding API."""

    def __init__(self, api_key: str):
        self._api_key = api_key

    async def geocode(
        self,
        place_name: str,
        place_id: Optional[str] = None,
        language: str = "es",
    ) -> List[GeocodingResult]:
        trimmed_name = place_name.strip().strip('{}') if place_name else ""

        if not trimmed_name and not place_id:
            logger.warning(f"{LOG_PREFIX} Geocode request skipped: empty name and ID.")
            return []

        async with httpx.AsyncClient(timeout=15.0) as client:
            # Resolve Hex/CID format
            place_id_to_use = place_id
            if place_id_to_use and HEX_CID_PATTERN.match(place_id_to_use):
                logger.info(f"{LOG_PREFIX} Hex CID detected. Resolving to standard Place ID...")
                resolved = await self._resolve_cid(client, place_id_to_use)
                if resolved:
                    place_id_to_use = resolved
                    logger.info(f"{LOG_PREFIX} CID resolved to Place ID: {place_id_to_use}")
                elif trimmed_name:
                    logger.warning(f"{LOG_PREFIX} CID resolution failed, falling back to name.")
                    place_id_to_use = None
                else:
                    logger.error(f"{LOG_PREFIX} CID resolution failed and no name available.")
                    return []

            # Build geocode request
            params: dict = {"key": self._api_key, "language": language}
            if place_id_to_use:
                params["place_id"] = place_id_to_use
            else:
                params["address"] = trimmed_name

            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params=params,
            )
            data = resp.json()
            status = data.get("status", "")

            if status == "ZERO_RESULTS":
                logger.warning(f"{LOG_PREFIX} ZERO_RESULTS for \"{trimmed_name}\" in Geocoding API. Proceeding to secondary search...")
            elif status == "INVALID_REQUEST":
                logger.error(f"{LOG_PREFIX} INVALID_REQUEST. PlaceID: {place_id_to_use}, Name: {trimmed_name}")
                return []
            elif status != "OK":
                error_msg = data.get("error_message", "Unknown error")
                logger.error(f"{LOG_PREFIX} API error ({status}): {error_msg}")
                raise Exception(f"Google Maps API error ({status}): {error_msg}")

            # If no place_id, try Places Text Search first for POIs (schools, etc.)
            if not place_id_to_use and trimmed_name:
                logger.info(f"{LOG_PREFIX} Searching for POIs using Places API: \"{trimmed_name}\"")
                place_results = await self._search_places(client, trimmed_name, language)
                if place_results:
                    logger.info(f"{LOG_PREFIX} Places API found {len(place_results)} results for \"{trimmed_name}\".")
                    return place_results
                else:
                    logger.warning(f"{LOG_PREFIX} Places API found 0 results for \"{trimmed_name}\".")

            # Fallback/Default: Geocoding API
            raw_results = data.get("results", [])
            if not raw_results:
                return []

            # Extract details for each result and attempt reverse geocoding for missing municipio
            results: List[GeocodingResult] = []
            for i, raw in enumerate(raw_results):
                result = self._extract_place_details(raw, i)

                # Reverse geocode if city missing but we have province+country+coords
                if not result.city and result.province and result.country and result.lat and result.lng:
                    reverse = await self._reverse_geocode(client, result.lat, result.lng, language)
                    if reverse:
                        if not result.city and reverse.city:
                            result.city = reverse.city
                        if not result.province and reverse.province:
                            result.province = reverse.province
                        if not result.region and reverse.region:
                            result.region = reverse.region
                        if not result.country and reverse.country:
                            result.country = reverse.country

                self._normalize_spanish_region(result)
                results.append(result)

            return results

    async def _resolve_cid(self, client: httpx.AsyncClient, hex_cid: str) -> Optional[str]:
        """Resolve a hex CID (0x...:0x...) to a standard Google Place ID."""
        try:
            parts = hex_cid.split(":")
            if len(parts) != 2:
                return None
            cid_decimal = str(int(parts[1], 16))
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
                params={
                    "input": f"cid:{cid_decimal}",
                    "inputtype": "textquery",
                    "fields": "place_id",
                    "key": self._api_key,
                },
            )
            data = resp.json()
            candidates = data.get("candidates", [])
            if data.get("status") == "OK" and candidates:
                return candidates[0].get("place_id")
            return None
        except Exception as e:
            logger.error(f"{LOG_PREFIX} _resolve_cid error: {e}")
            return None

    async def _reverse_geocode(
        self, client: httpx.AsyncClient, lat: float, lng: float, language: str
    ) -> Optional[GeocodingResult]:
        """Reverse geocode coordinates to fill in missing fields."""
        try:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={
                    "latlng": f"{lat},{lng}",
                    "key": self._api_key,
                    "language": language,
                },
            )
            data = resp.json()
            if data.get("status") == "OK" and data.get("results"):
                return self._extract_place_details(data["results"][0], 0)
            return None
        except Exception as e:
            logger.error(f"{LOG_PREFIX} Reverse geocode failed: {e}")
            return None

    async def _search_places(
        self, client: httpx.AsyncClient, query: str, language: str
    ) -> List[GeocodingResult]:
        """Search for Places (POIs) using Google Places API (New)."""
        try:
            headers = {
                "X-Goog-Api-Key": self._api_key,
                "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents"
            }
            payload = {
                "textQuery": query,
                "languageCode": language
            }
            resp = await client.post(
                "https://places.googleapis.com/v1/places:searchText",
                headers=headers,
                json=payload
            )
            data = resp.json()
            
            if resp.status_code == 200:
                raw_results = data.get("places", [])
                results: List[GeocodingResult] = []
                for i, raw in enumerate(raw_results):
                    result = self._extract_from_place_result(raw, i)
                    self._normalize_spanish_region(result)
                    results.append(result)
                return results
            
            error_msg = data.get("error", {}).get("message", "Unknown error")
            logger.error(f"{LOG_PREFIX} Places Text Search (New API) failed with status {resp.status_code}: {error_msg}")
            raise Exception(f"Google Places API error ({resp.status_code}): {error_msg}")
        except Exception as e:
            logger.error(f"{LOG_PREFIX} Places Text Search exception: {e}")
            return []

    def _extract_from_place_result(self, result: dict, index: int) -> GeocodingResult:
        """Extract GeocodingResult from a Places API (New) result."""
        location = result.get("location", {})
        display_name = result.get("displayName", {}).get("text", "")
        components = result.get("addressComponents", [])

        def lookup(type_list: list[str]) -> str:
            for comp in components:
                comp_types = comp.get("types", [])
                if any(t in comp_types for t in type_list):
                    return (comp.get("longText") or "").strip()
            return ""

        details = GeocodingResult(
            name=display_name,
            neighborhood=lookup(["postal_town", "sublocality"]),
            city=lookup(["locality", "administrative_area_level_4", "administrative_area_level_3"]),
            province=lookup(["administrative_area_level_2"]),
            region=lookup(["administrative_area_level_1"]),
            country=lookup(["country"]),
            google_place_id=result.get("id"),
            lat=location.get("latitude"),
            lng=location.get("longitude"),
            formatted_address=result.get("formattedAddress"),
        )
        logger.info(f"{LOG_PREFIX} Place Result #{index + 1}: {details.name} ({details.formatted_address})")
        return details

    def _extract_place_details(self, result: dict, index: int) -> GeocodingResult:
        """Extract structured place details from a Google Geocode API result."""
        components = result.get("address_components", [])

        def lookup(type_list: list[str]) -> str:
            for comp in components:
                comp_types = comp.get("types", [])
                if any(t in comp_types for t in type_list):
                    value = (comp.get("long_name") or "").strip()
                    if value:
                        return value
            return ""

        geometry = result.get("geometry", {})
        location = geometry.get("location", {})

        details = GeocodingResult(
            name=lookup(["locality"]),
            neighborhood=lookup(["postal_town", "sublocality"]),
            city=lookup(["locality", "administrative_area_level_4", "administrative_area_level_3"]),
            province=lookup(["administrative_area_level_2"]),
            region=lookup(["administrative_area_level_1"]),
            country=lookup(["country"]),
            google_place_id=result.get("place_id"),
            lat=location.get("lat"),
            lng=location.get("lng"),
            formatted_address=result.get("formatted_address"),
        )

        logger.info(f"{LOG_PREFIX} Result #{index + 1}: {details.formatted_address}")
        return details

    def _normalize_spanish_region(self, place: GeocodingResult) -> None:
        """Normalize region for Spanish places using province-to-CCAA mapping."""
        if not place.country or place.country.lower() not in ("españa", "spain"):
            return
        if not place.province:
            return
        region = PROVINCE_TO_REGION.get(place.province.strip())
        if region:
            logger.info(f"{LOG_PREFIX} Normalizing region: \"{place.province}\" -> \"{region}\"")
            place.region = region
