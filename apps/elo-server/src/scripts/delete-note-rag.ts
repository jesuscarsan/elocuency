import { config } from 'dotenv';
import { Pool, PoolConfig } from 'pg';
import { WinstonLoggerAdapter } from '../infrastructure/logging/WinstonLoggerAdapter';
import path from 'path';

config({ path: '../../.env' }); // Load repo root

async function deleteNoteRag() {
  const logger = new WinstonLoggerAdapter('delete-note-rag');

  const arg = process.argv[2];
  if (!arg) {
    console.error('\n❌ Please provide a note title to delete or use --all to clear the database.');
    console.error('   Usage: npx ts-node delete-note-rag.ts "Note Title"');
    console.error('   Usage: npx ts-node delete-note-rag.ts --all');
    process.on('uncaughtException', (err) => {
      console.error(err);
      process.exit(1);
    });
    process.exit(1);
  }

  const deleteAll = arg === '--all' || arg === '-a';
  const title = deleteAll ? null : arg;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.error('\n❌ DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const connectionString = dbUrl.replace('pgvector', 'localhost');
  const poolConfig: PoolConfig = { connectionString };
  const pool = new Pool(poolConfig);

  if (deleteAll) {
    logger.info(`🔥 TRUNCATING database: removing ALL chunks...`);
  } else {
    logger.info(`🔍 Searching for chunks of note: "${title}"...`);
  }

  try {
    const query = deleteAll 
      ? "DELETE FROM langchain_pg_embedding"
      : "DELETE FROM langchain_pg_embedding WHERE cmetadata->>'title' = $1";
    const params = deleteAll ? [] : [title];

    const res = await pool.query(query, params);

    if (res.rowCount && res.rowCount > 0) {
      if (deleteAll) {
        logger.info(`✅ Successfully deleted ALL ${res.rowCount} chunks from database.`);
      } else {
        logger.info(`✅ Successfully deleted ${res.rowCount} chunks for note: "${title}"`);
      }
    } else {
      if (deleteAll) {
        logger.warn(`⚠️ Database was already empty.`);
      } else {
        logger.warn(`⚠️ No chunks found for note: "${title}"`);
      }
    }

  } catch (err) {
    logger.error(`❌ Error deleting chunks for note: ${title}`);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }

  process.exit(0);
}

deleteNoteRag().catch(err => {
  console.error(err);
  process.exit(1);
});
