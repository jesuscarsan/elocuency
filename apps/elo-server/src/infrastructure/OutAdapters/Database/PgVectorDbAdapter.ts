import { VectorDbPort, VectorDocument, VectorSearchResult } from '../../../domain/ports/VectorDbPort';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PoolConfig } from 'pg';

export interface PgVectorConfig {
  connectionString: string;
  apiKey: string;
  embeddingModel?: string;
  tableName?: string;
}

export class PgVectorDbAdapter implements VectorDbPort {
  private vectorStore: PGVectorStore | null = null;
  private readonly config: PgVectorConfig;

  constructor(config: PgVectorConfig) {
    this.config = config;
  }

  public async init(): Promise<void> {
    if (this.vectorStore) return;

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.config.apiKey,
      model: this.config.embeddingModel || 'models/gemini-embedding-2-preview',
    });

    const poolConfig: PoolConfig = {
      connectionString: this.config.connectionString,
    };

    this.vectorStore = await PGVectorStore.initialize(embeddings, {
      postgresConnectionOptions: poolConfig,
      tableName: this.config.tableName || 'langchain_pg_embedding',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'document',
        metadataColumnName: 'cmetadata',
      },
    });
  }

  public async addDocuments(documents: VectorDocument[]): Promise<void> {
    await this.ensureInitialized();

    const { Document } = await import('@langchain/core/documents');
    const langchainDocs = documents.map(
      (doc) => new Document({ pageContent: doc.content, metadata: { ...doc.metadata, id: doc.id } })
    );

    await this.vectorStore!.addDocuments(langchainDocs);
  }

  public async search(query: string, limit = 5): Promise<VectorSearchResult[]> {
    await this.ensureInitialized();

    const docs = await this.vectorStore!.similaritySearch(query, limit);

    return docs.map((d) => ({
      id: (d.metadata?.id as string) || 'unknown',
      score: 1, // PGVectorStore.similaritySearch doesn't return scores directly
      content: d.pageContent,
      metadata: d.metadata as Record<string, unknown>,
    }));
  }

  public async deleteDocument(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.vectorStore!.delete({ ids: [id] });
  }

  public async close(): Promise<void> {
    if (this.vectorStore) {
      await this.vectorStore.end();
      this.vectorStore = null;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.vectorStore) {
      await this.init();
    }
  }
}
