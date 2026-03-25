import { config } from 'dotenv';
import { FileSystemNoteRepositoryAdapter } from '../infrastructure/OutAdapters/Memory/FileSystemNoteRepositoryAdapter';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PoolConfig } from 'pg';
import { WinstonLoggerAdapter } from '../infrastructure/logging/WinstonLoggerAdapter';
import path from 'path';
import fs from 'fs';

config({ path: '../../.env' }); // Load repo root

async function syncMemory() {
  const logFile = process.env.ELO_WORKSPACE_PATH 
    ? path.join(process.env.ELO_WORKSPACE_PATH, 'logs', 'sync-memory.log')
    : undefined;
  const logger = new WinstonLoggerAdapter('sync-memory', logFile);

  logger.info('--- Starting Memory -> Postgres Synchronization ---');
  
  const memoryPath = process.env.MEMORY_PATH;
  if (!memoryPath) {
    console.error('\n❌ MEMORY_PATH environment variable is not set.');
    console.error('   Set it in your .env file to the absolute path of your Obsidian memory.');
    process.exit(1);
  }

  console.log(`📂 Memory path: ${memoryPath}`);

  let noteRepo: FileSystemNoteRepositoryAdapter;
  try {
    noteRepo = new FileSystemNoteRepositoryAdapter(memoryPath, logger);
  } catch (e: any) {
    logger.error(`\n❌ ${e.message}`);
    process.exit(1);
  }
  
  logger.info("Scanning memory for markdown files...");
  const notes = await noteRepo.getAllNotes();
  
  if (!notes || notes.length === 0) {
    logger.error("❌ No notes found in the memory.");
    process.exit(1);
  }
  
  logger.info(`Found ${notes.length} notes. Processing...`);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.error('\n❌ DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  // For local CLI usage, replace docker hostname with localhost
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

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  let processed = 0;
  let currentNoteIndex = 0;
  const totalNotes = notes.length;
  
  for (const note of notes) {
    currentNoteIndex++;
    const percent = Math.round((currentNoteIndex / totalNotes) * 100);
    process.stdout.write(`\r⏳ Progress: [${currentNoteIndex}/${totalNotes}] ${percent}% | Chunks: ${processed}    `);

    if (!note.content) continue;
    
    const docs = await textSplitter.createDocuments(
      [note.content],
      [{ path: note.id, source: note.id, title: note.title, tags: note.tags }]
    );
    
    const validDocs = docs.filter(doc => doc.pageContent.trim().length > 0);

    if (validDocs.length > 0) {
      try {
        const texts = validDocs.map(doc => doc.pageContent);
        const vectors = await embeddings.embedDocuments(texts);
        
        const safeVectors: number[][] = [];
        const safeDocs = [];
        
        for (let i = 0; i < vectors.length; i++) {
          if (vectors[i] && vectors[i].length > 0) {
            safeVectors.push(vectors[i]);
            safeDocs.push(validDocs[i]);
          } else {
            logger.warn(`⚠️ Warning: Empty vector generated for chunk of note ${note.id}`);
          }
        }
        
        if (safeVectors.length > 0) {
          await vectorStore.addVectors(safeVectors, safeDocs);
          processed += safeVectors.length;
        }
      } catch (err) {
        logger.error(`❌ Error adding documents for note: ${note.id}`);
        docs.forEach((d, i) => logger.error(`Doc ${i}: ${JSON.stringify(d.pageContent)}`));
        throw err;
      }
    }
  }

  await vectorStore.end();

  logger.info(`\n✅ Successfully synchronized ${processed} chunks to PostgreSQL!`);
  process.exit(0);
}

syncMemory().catch(err => {
  console.error(err);
  process.exit(1);
});
