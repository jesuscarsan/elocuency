export interface WebSearchResult {
  title: string;
  snippet: string;
  link: string;
}

export interface WebSearchPort {
  search(query: string, count?: number): Promise<WebSearchResult[]>;
}
