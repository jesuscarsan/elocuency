export type GeocodingParams = {
  placeName: string;
  placeId?: string;
};

export type GeocodingResponse = {
  name?: string;
  neighborhood?: string;
  city: string;
  province: string;
  region: string;
  country: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
  capital?: string;
};
export interface GeocodingPort {
  requestPlaceDetails(
    params: GeocodingParams,
  ): Promise<GeocodingResponse | null>;
}
