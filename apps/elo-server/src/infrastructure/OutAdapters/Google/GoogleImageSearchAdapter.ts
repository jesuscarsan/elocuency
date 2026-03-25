import { ImageSearchPort } from '../../../domain/ports/ImageSearchPort';

export class GoogleImageSearchAdapter implements ImageSearchPort {
  private apiKey: string;
  private searchEngineId: string;

  constructor(apiKey: string, searchEngineId: string) {
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
  }

  async searchImages(query: string, count: number = 10): Promise<string[]> {
    if (!this.apiKey || !this.searchEngineId) {
      console.error('Google Search credentials missing');
      return [];
    }

    try {
      const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
        query
      )}&cx=${this.searchEngineId}&key=${this.apiKey}&searchType=image&num=${Math.min(count, 10)}`;

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Google Image Search failed: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      
      if (data.items && Array.isArray(data.items)) {
        return data.items.map((item: any) => item.link).filter(Boolean);
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching images from Google Custom Search API:', error);
      return [];
    }
  }
}
