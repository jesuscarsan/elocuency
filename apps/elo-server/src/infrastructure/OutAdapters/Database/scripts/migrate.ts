import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { LATEST_DB_VERSION } from '../../../Config/DbVersion';

// 1. Load Environment Variables
const rootEnv = path.join(__dirname, '../../../../../../.env');
dotenv.config({ path: rootEnv });

const DATABASE_URL = process.env.DATABASE_URL;
const WORKSPACE_PATH = process.env.ELO_WORKSPACE_PATH;

if (!DATABASE_URL) {
  console.error('[FATAL] DATABASE_URL not found in .env');
  process.exit(1);
}

if (!WORKSPACE_PATH) {
  console.error('[FATAL] ELO_WORKSPACE_PATH not found in .env');
  process.exit(1);
}

const configPath = path.join(WORKSPACE_PATH, 'elo-config.json');

async function migrate() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log(`\n🚀 Starting Database Migration (Target Version: ${LATEST_DB_VERSION})`);
    
    // 2. Load Current Config Version
    let currentVersion = 0;
    let configData: any = {};
    
    if (fs.existsSync(configPath)) {
      configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      currentVersion = configData.dbVersion || 0;
    } else {
      console.warn(`[WARN] elo-config.json not found at ${configPath}. Initializing with v0.`);
    }

    // 3. Check if DB is empty or already exists (legacy check)
    const tableCheck = await pool.query(`
      SELECT count(*) FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'system_task'
    `);
    
    const dbHasTables = parseInt(tableCheck.rows[0].count) > 0;

    // 4. Case: Fresh Install
    if (!dbHasTables) {
      console.log('✨ Database is empty. Applying full baseline schema (v2)...');
      const schemaSql = fs.readFileSync(path.join(__dirname, '../migrations/schema.sql'), 'utf8');
      await pool.query(schemaSql);
      
      currentVersion = LATEST_DB_VERSION;
      console.log(`✅ Baseline applied. Current version: ${currentVersion}`);
    } 
    // 5. Case: Incremental Updates
    else {
      // If tables exist but no version in config, it's a legacy v1 install
      if (currentVersion === 0) {
        console.log('📜 Detected existing tables but no version in config. Assuming v1.');
        currentVersion = 1;
      }

      console.log(`📈 Current version in config: ${currentVersion}`);

      for (let v = currentVersion + 1; v <= LATEST_DB_VERSION; v++) {
        const updateFile = path.join(__dirname, `../migrations/updates/v${String(v).padStart(3, '0')}.sql`);
        if (fs.existsSync(updateFile)) {
          console.log(`🔧 Applying update: v${v}...`);
          const sql = fs.readFileSync(updateFile, 'utf8');
          await pool.query(sql);
        } else {
          console.error(`[ERROR] Migration file missing: ${updateFile}`);
          process.exit(1);
        }
        currentVersion = v;
      }
    }

    // 6. Update elo-config.json
    configData.dbVersion = currentVersion;
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 4), 'utf8');
    console.log(`\n🎉 Migration successful! Updated elo-config.json to dbVersion: ${currentVersion}\n`);

  } catch (error: any) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
