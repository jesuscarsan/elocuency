export interface ImageContent {
    data: string;
    mimeType: string;
}
export interface ImageAnalysisResult {
    literal_transcription: string;
    analysis: string;
}
export declare class EloServerImagesAdapter {
    private baseUrl;
    private authToken;
    constructor(baseUrl: string, authToken: string);
    private fetchAi;
    generateContentFromImages(images: ImageContent[], additionalPrompt?: string): Promise<ImageAnalysisResult | null>;
    generateEnrichmentFromImages(images: ImageContent[], promptTemplate: string): Promise<{
        body?: string;
        frontmatter?: Record<string, unknown>;
    } | null>;
}
