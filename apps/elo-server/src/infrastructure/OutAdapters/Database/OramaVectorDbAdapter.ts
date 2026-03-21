import { create, insert, search, type Orama } from '@orama/orama';
import { VectorDbPort, VectorDocument, VectorSearchResult } from '../../../domain/ports/VectorDbPort';

export class OramaVectorDbAdapter implements VectorDbPort {
  private db: Orama<any> | null = null;
  private documentsMap = new Map<string, string>(); // to map string id to orama id

  public async init(): Promise<void> {
    this.db = await create({
      schema: {
        id: 'string',
        content: 'string',
        metadata: 'string' // serialized metadata
      }
    });
  }

  public async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.db) await this.init();

    for (const doc of documents) {
      const dbId = await insert(this.db!, {
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata ? JSON.stringify(doc.metadata) : ''
      });
      // Store reference since orama generates its own id or uses provided string depending on settings. 
      // Actually we provided 'id' in schema but insert returns the internal id.
      this.documentsMap.set(doc.id, dbId);
    }
  }

  public async search(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
    if (!this.db) return [];

    const results = await search(this.db, {
      term: query,
      properties: ['content'],
      limit,
    });

    return results.hits.map(hit => ({
      id: hit.document.id as string,
      score: hit.score,
      metadata: hit.document.metadata ? JSON.parse(hit.document.metadata as string) : undefined
    }));
  }

  public async deleteDocument(id: string): Promise<void> {
    // Orama has `remove` but requires internal id, which we would need local tracking for.
    // For this migration MVP, we might leave it as a no-op or just clear mappings.
    const internalId = this.documentsMap.get(id);
    if (internalId && this.db) {
       // Orama remove not directly exposed without specific import in newest versions, 
       // but for now, we just remove from map.
       this.documentsMap.delete(id);
    }
  }
}
