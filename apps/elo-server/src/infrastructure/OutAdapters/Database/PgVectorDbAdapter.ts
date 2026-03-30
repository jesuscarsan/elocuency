import { VectorDbPort, VectorDocument, VectorSearchResult } from '../../../domain/ports/VectorDbPort';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Pool, PoolConfig } from 'pg';

export interface PgVectorConfig {
  connectionString?: string;
  pool?: Pool;
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

    if (this.config.pool) {
      this.vectorStore = await PGVectorStore.initialize(embeddings, {
        pool: this.config.pool,
        tableName: this.config.tableName || 'langchain_pg_embedding',
        columns: {
          idColumnName: 'id',
          vectorColumnName: 'embedding',
          contentColumnName: 'document',
          metadataColumnName: 'cmetadata',
        },
      });
    } else {
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

  public async deleteNoteDocuments(noteId: string): Promise<void> {
    await this.ensureInitialized();
    // Raw SQL to delete by metadata path
    const tableName = this.config.tableName || 'langchain_pg_embedding';
    // We access the pool through the vectorStore's internal pool if possible, 
    // but better use a query on the vectorStore if it supports it.
    // PGVectorStore doesn't expose a clean "delete by metadata" in its public API easily, 
    // so we use the internal pool (which is in pgvector's connection pool)
    
    // @ts-ignore - access internal pool for direct delete
    const pool = (this.vectorStore as any).pool;
    if (pool) {
      await pool.query(`DELETE FROM ${tableName} WHERE cmetadata->>'path' = $1`, [noteId]);
    }
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
