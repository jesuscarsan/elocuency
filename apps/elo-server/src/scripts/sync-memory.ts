import { config } from 'dotenv';
import { FileSystemNoteRepositoryAdapter } from '../infrastructure/OutAdapters/Memory/FileSystemNoteRepositoryAdapter';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Pool, PoolConfig } from 'pg';
import { WinstonLoggerAdapter } from '../infrastructure/logging/WinstonLoggerAdapter';
import path from 'path';
import fs from 'fs';
import { MarkdownCleaner } from '../application/services/MarkdownCleaner';

config({ path: '../../.env' }); // Load repo root

// Load elo-config.json to get worldPath
const eloWorkspacePath = process.env.ELO_WORKSPACE_PATH;
const configPath = eloWorkspacePath ? path.join(eloWorkspacePath, 'elo-config.json') : null;
let worldPathPrefix = 'Mi mundo'; // Default fallback

const isTestMode = process.argv.includes('--test') || process.env.TEST_MODE === 'true';
if (isTestMode) {
  console.log('🧪 Test Mode Enabled');
  worldPathPrefix = ''; // No prefix for test folder
}

if (!isTestMode && configPath && fs.existsSync(configPath)) {
  try {
    const eloConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (eloConfig.memory && eloConfig.memory.worldPath) {
      worldPathPrefix = eloConfig.memory.worldPath;
    }
  } catch (e) {
    console.warn('⚠️ Warning: Failed to parse elo-config.json, using default worldPath');
  }
}

async function syncMemory() {
  const logFile = process.env.ELO_WORKSPACE_PATH 
    ? path.join(process.env.ELO_WORKSPACE_PATH, 'logs', 'sync-memory.log')
    : undefined;
  const logger = new WinstonLoggerAdapter('sync-memory', logFile);

  const initializeFlag = process.argv.includes('--initialize') || process.argv.includes('-i');
  
  if (initializeFlag) {
    logger.info('🧹 Initialize mode: Clearing vector database before sync...');
  }

  let memoryPath = process.env.MEMORY_PATH;
  
  if (isTestMode) {
    memoryPath = path.join(__dirname, '../../assets/memory-test');
  }

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
  const pool = new Pool(poolConfig);

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

  if (initializeFlag) {
    logger.info('🔥 Deleting ALL previous entries from langchain_pg_embedding...');
    try {
      await pool.query("DELETE FROM langchain_pg_embedding");
      logger.info('✅ Database cleared.');
    } catch (err) {
      logger.error('❌ Error clearing database in initialize mode');
      throw err;
    }
  }

  const { MarkdownTextSplitter } = await import('@langchain/textsplitters');
  const textSplitter = new MarkdownTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const cleaner = new MarkdownCleaner();

  let processed = 0;
  let currentNoteIndex = 0;
  const totalNotes = notes.length;
  
  for (const note of notes) {
    currentNoteIndex++;
    const percent = Math.round((currentNoteIndex / totalNotes) * 100);
    process.stdout.write(`\r⏳ Progress: [${currentNoteIndex}/${totalNotes}] ${percent}% | Chunks: ${processed}    `);

    if (!note.content) continue;
    
    // Normalize paths and title
    const noteId = note.id; // full relative path
    const title = path.basename(noteId, '.md');
    
    // Normalize path by stripping worldPath prefix and .md extension
    let normalizedPath = noteId.endsWith('.md') ? noteId.slice(0, -3) : noteId;
    if (normalizedPath.startsWith(worldPathPrefix + '/')) {
      normalizedPath = normalizedPath.slice(worldPathPrefix.length + 1);
    } else if (normalizedPath === worldPathPrefix) {
      normalizedPath = ''; // Root world path note
    }

    // Delete existing entries for this note title to prevent duplicates
    try {
      await pool.query(
        "DELETE FROM langchain_pg_embedding WHERE cmetadata->>'title' = $1", 
        [title]
      );
    } catch (err) {
      logger.error(`❌ Error deleting previous entries for title: ${title}`);
      throw err;
    }

    const cleanContent = cleaner.clean(note.content, { path: normalizedPath, title: title });

    // Context Injection: Prepend Title to every chunk
    const contentWithContext = `Title: ${title}\n\n${cleanContent}`;

    const docs = await textSplitter.createDocuments(
      [contentWithContext],
      [{ 
        path: normalizedPath, 
        source: normalizedPath, 
        title: title, 
        tags: note.tags 
      }]
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
  await pool.end();

  logger.info(`\n✅ Successfully synchronized ${processed} chunks to PostgreSQL!`);
  process.exit(0);
}

syncMemory().catch(err => {
  console.error(err);
  process.exit(1);
});
