import { WebSearchPort, WebSearchResult } from '../../../domain/ports/WebSearchPort';

export class GoogleWebSearchAdapter implements WebSearchPort {
  private apiKey: string;
  private searchEngineId: string;

  constructor(apiKey: string, searchEngineId: string) {
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
  }

  async search(query: string, count: number = 5): Promise<WebSearchResult[]> {
    if (!this.apiKey || !this.searchEngineId) {
      console.error('Google Search credentials missing');
      return [];
    }

    try {
      const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
        query
      )}&cx=${this.searchEngineId}&key=${this.apiKey}&num=${Math.min(count, 10)}`;

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Google Web Search failed: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      
      if (data.items && Array.isArray(data.items)) {
        return data.items.map((item: any) => ({
          title: item.title,
          snippet: item.snippet,
          link: item.link
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching search results from Google Custom Search API:', error);
      return [];
    }
  }
}
