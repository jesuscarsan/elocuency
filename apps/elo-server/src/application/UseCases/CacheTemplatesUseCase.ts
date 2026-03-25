import { TemplateCachePort } from '../../domain/ports/TemplateCachePort';
import { LoggerPort } from '../../domain/ports/LoggerPort';

export class CacheTemplatesUseCase {
  constructor(
    private readonly templateCache: TemplateCachePort,
    private readonly logger: LoggerPort
  ) {}

  public async execute(): Promise<void> {
    this.logger.info('Building template cache...');
    const templates = await this.templateCache.buildCache();
    this.logger.info(`Successfully cached ${templates.length} templates.`);
  }
}
