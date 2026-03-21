export interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorDbPort {
  addDocuments(documents: VectorDocument[]): Promise<void>;
  search(query: string, limit?: number): Promise<VectorSearchResult[]>;
  deleteDocument(id: string): Promise<void>;
}
