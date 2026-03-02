export interface ImageServicePort {
    searchImages(query: string, count: number): Promise<string[]>;
}
