export interface GeocodingResult {
  name: string;
  neighborhood?: string;
  city?: string;
  province?: string;
  region?: string;
  country?: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
}

export interface GeocodingPort {
  geocode(placeName: string, placeId?: string, language?: string): Promise<GeocodingResult[]>;
}
