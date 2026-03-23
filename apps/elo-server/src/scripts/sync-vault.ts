import { config } from 'dotenv';
import { FileSystemNoteRepositoryAdapter } from '../infrastructure/OutAdapters/Vault/FileSystemNoteRepositoryAdapter';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PoolConfig } from 'pg';

config({ path: '../../.env' }); // Load repo root

async function syncVault() {
  console.log('--- Starting Vault -> Postgres Synchronization ---');
  
  const vaultPath = process.env.VAULT_PATH;
  if (!vaultPath) {
    console.error('\n❌ VAULT_PATH environment variable is not set.');
    console.error('   Set it in your .env file to the absolute path of your Obsidian vault.');
    process.exit(1);
  }

  console.log(`📂 Vault path: ${vaultPath}`);

  let noteRepo: FileSystemNoteRepositoryAdapter;
  try {
    noteRepo = new FileSystemNoteRepositoryAdapter(vaultPath);
  } catch (e: any) {
    console.error(`\n❌ ${e.message}`);
    process.exit(1);
  }
  
  console.log("Scanning vault for markdown files...");
  const notes = await noteRepo.getAllNotes();
  
  if (!notes || notes.length === 0) {
    console.error("❌ No notes found in the vault.");
    process.exit(1);
  }
  
  console.log(`Found ${notes.length} notes. Processing...`);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('\n❌ DATABASE_URL environment variable is not set.');
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
            console.warn(`⚠️ Warning: Empty vector generated for chunk of note ${note.id}`);
          }
        }
        
        if (safeVectors.length > 0) {
          await vectorStore.addVectors(safeVectors, safeDocs);
          processed += safeVectors.length;
        }
      } catch (err) {
        console.error(`❌ Error adding documents for note: ${note.id}`);
        docs.forEach((d, i) => console.error(`Doc ${i}:`, JSON.stringify(d.pageContent)));
        throw err;
      }
    }
  }

  await vectorStore.end();

  console.log(`\n✅ Successfully synchronized ${processed} chunks to PostgreSQL!`);
  process.exit(0);
}

syncVault().catch(err => {
  console.error(err);
  process.exit(1);
});
