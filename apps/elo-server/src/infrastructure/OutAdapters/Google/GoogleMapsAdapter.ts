import { GeocodingPort, GeocodingResult } from '../../../domain/ports/GeocodingPort';

const PROVINCE_TO_REGION: Record<string, string> = {
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
};

const HEX_CID_PATTERN = /^0x[a-fA-F0-9]+:0x[a-fA-F0-9]+$/;

export class GoogleMapsGeocodingAdapter implements GeocodingPort {
  constructor(private readonly apiKey: string) {}

  public async geocode(placeName: string, placeId?: string, language = "es"): Promise<GeocodingResult[]> {
    const trimmedName = (placeName || "").trim().replace(/^\{|\}$/g, '');

    if (!trimmedName && !placeId) {
      console.warn("Geocode request skipped: empty name and ID.");
      return [];
    }

    let placeIdToUse = placeId;

    if (placeIdToUse && HEX_CID_PATTERN.test(placeIdToUse)) {
      console.log("Hex CID detected. Resolving to standard Place ID...");
      const resolved = await this.resolveCid(placeIdToUse);
      if (resolved) {
        placeIdToUse = resolved;
      } else if (trimmedName) {
        placeIdToUse = undefined;
      } else {
        return [];
      }
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.append("key", this.apiKey);
    url.searchParams.append("language", language);
    
    if (placeIdToUse) url.searchParams.append("place_id", placeIdToUse);
    else url.searchParams.append("address", trimmedName);

    const resp = await fetch(url.toString());
    const data = await resp.json();
    const status = data.status;

    if (status === "ZERO_RESULTS") {
      console.warn(`ZERO_RESULTS for "${trimmedName}". Proceeding to secondary search...`);
    } else if (status === "INVALID_REQUEST") {
      console.error(`INVALID_REQUEST. PlaceID: ${placeIdToUse}, Name: ${trimmedName}`);
      return [];
    } else if (status !== "OK") {
      throw new Error(`Google Maps API error (${status}): ${data.error_message || "Unknown error"}`);
    }

    if (!placeIdToUse && trimmedName && status !== "OK") {
      const placeResults = await this.searchPlaces(trimmedName, language);
      if (placeResults.length > 0) return placeResults;
    }

    const rawResults = data.results || [];
    if (rawResults.length === 0) return [];

    const results: GeocodingResult[] = [];
    for (const raw of rawResults) {
      const result = this.extractPlaceDetails(raw);
      
      if (!result.city && result.province && result.country && result.lat && result.lng) {
        const reverse = await this.reverseGeocode(result.lat, result.lng, language);
        if (reverse) {
          if (!result.city && reverse.city) result.city = reverse.city;
          if (!result.province && reverse.province) result.province = reverse.province;
          if (!result.region && reverse.region) result.region = reverse.region;
          if (!result.country && reverse.country) result.country = reverse.country;
        }
      }

      this.normalizeSpanishRegion(result);
      results.push(result);
    }

    return results;
  }

  private async resolveCid(hexCid: string): Promise<string | undefined> {
    try {
      const parts = hexCid.split(":");
      if (parts.length !== 2) return undefined;
      
      const cidDecimal = BigInt(parts[1]).toString(10);
      const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
      url.searchParams.append("input", `cid:${cidDecimal}`);
      url.searchParams.append("inputtype", "textquery");
      url.searchParams.append("fields", "place_id");
      url.searchParams.append("key", this.apiKey);

      const resp = await fetch(url.toString());
      const data = await resp.json();
      if (data.status === "OK" && data.candidates && data.candidates.length > 0) {
        return data.candidates[0].place_id;
      }
    } catch (e) {
      console.error("Resolve CID error:", e);
    }
    return undefined;
  }

  private async reverseGeocode(lat: number, lng: number, language: string): Promise<GeocodingResult | undefined> {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.append("latlng", `${lat},${lng}`);
      url.searchParams.append("key", this.apiKey);
      url.searchParams.append("language", language);

      const resp = await fetch(url.toString());
      const data = await resp.json();
      if (data.status === "OK" && data.results && data.results.length > 0) {
        return this.extractPlaceDetails(data.results[0]);
      }
    } catch (e) {
      console.error("Reverse geocode failed:", e);
    }
    return undefined;
  }

  private async searchPlaces(query: string, language: string): Promise<GeocodingResult[]> {
    try {
      const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents"
        },
        body: JSON.stringify({
          textQuery: query,
          languageCode: language
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const rawResults = data.places || [];
        const results: GeocodingResult[] = [];
        for (const raw of rawResults) {
          const result = this.extractFromPlaceResult(raw);
          this.normalizeSpanishRegion(result);
          results.push(result);
        }
        return results;
      }
    } catch (e) {
      console.error("Places Text Search exception:", e);
    }
    return [];
  }

  private extractFromPlaceResult(result: any): GeocodingResult {
    const location = result.location || {};
    const displayName = result.displayName?.text || "";
    const components = result.addressComponents || [];

    const lookup = (typeList: string[]) => {
      for (const comp of components) {
        const compTypes: string[] = comp.types || [];
        if (compTypes.some(t => typeList.includes(t))) {
          return (comp.longText || "").trim();
        }
      }
      return "";
    };

    return {
      name: displayName,
      neighborhood: lookup(["postal_town", "sublocality"]),
      city: lookup(["locality", "administrative_area_level_4", "administrative_area_level_3"]),
      province: lookup(["administrative_area_level_2"]),
      region: lookup(["administrative_area_level_1"]),
      country: lookup(["country"]),
      googlePlaceId: result.id,
      lat: location.latitude,
      lng: location.longitude,
      formattedAddress: result.formattedAddress,
    };
  }

  private extractPlaceDetails(result: any): GeocodingResult {
    const components = result.address_components || [];

    const lookup = (typeList: string[]) => {
      for (const comp of components) {
        const compTypes: string[] = comp.types || [];
        if (compTypes.some(t => typeList.includes(t))) {
          return (comp.long_name || "").trim();
        }
      }
      return "";
    };

    const location = result.geometry?.location || {};

    return {
      name: lookup(["locality"]),
      neighborhood: lookup(["postal_town", "sublocality"]),
      city: lookup(["locality", "administrative_area_level_4", "administrative_area_level_3"]),
      province: lookup(["administrative_area_level_2"]),
      region: lookup(["administrative_area_level_1"]),
      country: lookup(["country"]),
      googlePlaceId: result.place_id,
      lat: location.lat,
      lng: location.lng,
      formattedAddress: result.formatted_address,
    };
  }

  private normalizeSpanishRegion(place: GeocodingResult): void {
    if (!place.country || !["españa", "spain"].includes(place.country.toLowerCase())) return;
    if (!place.province) return;

    const region = PROVINCE_TO_REGION[place.province.trim()];
    if (region) {
      place.region = region;
    }
  }
}
