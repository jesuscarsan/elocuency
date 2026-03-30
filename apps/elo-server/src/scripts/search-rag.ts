import { config } from 'dotenv';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PoolConfig } from 'pg';
import path from 'path';

config({ path: '../../.env' }); // Load repo root

async function searchRag() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set.');
    process.exit(1);
  }

  const connectionString = dbUrl.replace('pgvector', 'localhost');
  
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_AI_API_KEY,
    model: 'models/gemini-embedding-2-preview'
  });

  const poolConfig: PoolConfig = { connectionString };

  const vectorStore = await PGVectorStore.initialize(embeddings, {
    postgresConnectionOptions: poolConfig,
    tableName: 'langchain_pg_embedding',
    columns: {
      idColumnName: 'id',
      vectorColumnName: 'embedding',
      contentColumnName: 'document',
      metadataColumnName: 'cmetadata',
    },
  });

  const query = process.argv[2];
  if (!query) {
    console.error('❌ Please provide a search query.');
    console.log('Usage: npx ts-node src/scripts/search-rag.ts "your search text"');
    process.exit(1);
  }

  console.log(`\n🔍 Searching RAG for: "${query}"...\n`);

  const results = await vectorStore.similaritySearchWithScore(query, 10);

  if (results.length === 0) {
    console.log('❌ No results found.');
  } else {
    results.forEach(([doc, score], i) => {
      console.log(`--- Result #${i + 1} (Score: ${score.toFixed(4)}) ---`);
      console.log(`Path: ${doc.metadata.path || doc.metadata.source || 'Unknown'}`);
      console.log(`Title: ${doc.metadata.title || 'Untitled'}`);
      console.log(`Content excerpt:\n${doc.pageContent.substring(0, 300)}...`);
      console.log('\n');
    });
  }

  await vectorStore.end();
  process.exit(0);
}

searchRag().catch(err => {
  console.error('❌ Error during search:', err);
  process.exit(1);
});
