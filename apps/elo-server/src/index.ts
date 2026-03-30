import './env';
import { FastifyServer } from './infrastructure/Presentation/FastifyServer';
import { WinstonLoggerAdapter } from './infrastructure/logging/WinstonLoggerAdapter';
import path from 'path';

async function bootstrap() {
  const workspacePath = process.env.ELO_WORKSPACE_PATH || process.cwd();
  const logFile = path.join(workspacePath, 'logs', 'elo-server.log');

  const logger = new WinstonLoggerAdapter('elo-server', logFile);
  logger.info('Starting elo-server...');

  const server = new FastifyServer(logger);

  const port = process.env.PORT ? parseInt(process.env.PORT) : 8001;
  await server.start(port);
  logger.info(`Server started on port ${port}`);
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
