import { FastifyServer } from './infrastructure/Presentation/FastifyServer';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load workspace .env from setup folder
dotenv.config({ path: path.join(process.cwd(), '../../.env') });
// Also load local .env if it exists
dotenv.config();

async function bootstrap() {
  const server = new FastifyServer();
  await server.start(process.env.PORT ? parseInt(process.env.PORT) : 8001);
}

bootstrap().catch(console.error);
