import './env';
import { FastifyServer } from './infrastructure/Presentation/FastifyServer';

async function bootstrap() {
  const server = new FastifyServer();
  await server.start(process.env.PORT ? parseInt(process.env.PORT) : 8001);
}

bootstrap().catch(console.error);
