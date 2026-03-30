import './env';
import { FastifyServer } from './infrastructure/Presentation/FastifyServer';
import { WinstonLoggerAdapter } from './infrastructure/logging/WinstonLoggerAdapter';
import path from 'path';

async function bootstrap() {
  console.log('DEBUG: Bootstrap started');
  const workspacePath = process.env.ELO_WORKSPACE_PATH || process.cwd();
  console.log('DEBUG: Workspace path:', workspacePath);
  const logFile = path.join(workspacePath, 'logs', 'elo-server.log');
  console.log('DEBUG: Log file path:', logFile);
  
  const logger = new WinstonLoggerAdapter('elo-server', logFile);
  console.log('DEBUG: Logger initialized');
  logger.info('Starting elo-server...');

  console.log('DEBUG: Initializing FastifyServer');
  const server = new FastifyServer(logger);
  console.log('DEBUG: FastifyServer initialized');
  
  const port = process.env.PORT ? parseInt(process.env.PORT) : 8001;
  console.log('DEBUG: Starting server on port:', port);
  await server.start(port);
  console.log('DEBUG: Server started');
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
