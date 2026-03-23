import * as dotenv from 'dotenv';
import * as path from 'path';

// Load workspace .env from setup folder
dotenv.config({ path: path.join(process.cwd(), '../../.env') });
// Also load local .env if it exists
dotenv.config();
