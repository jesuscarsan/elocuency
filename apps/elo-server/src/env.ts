import * as dotenv from 'dotenv';
import * as path from 'path';

// Load workspace .env from setup folder
dotenv.config({ path: path.join(process.cwd(), '../../.env') });
// Also load local .env if it exists
dotenv.config();

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'MEMORY_PATH', 'BASIC_AI_MODEL'];
const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}
