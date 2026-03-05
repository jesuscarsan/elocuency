export declare type GeocodingParams = {
    placeName: string;
    placeId?: string;
};
export declare type GeocodingResponse = {
    lugar?: string;
    barrio?: string;
    municipio: string;
    provincia: string;
    region: string;
    pais: string;
    googlePlaceId?: string;
    lat?: number;
    lng?: number;
    capital?: string;
};
export interface GeocodingPort {
    requestPlaceDetails(params: GeocodingParams): Promise<GeocodingResponse | null>;
}
