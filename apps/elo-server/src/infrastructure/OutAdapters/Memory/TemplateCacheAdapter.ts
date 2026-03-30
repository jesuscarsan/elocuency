import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';
import { TemplateCachePort, TemplateInfo } from '../../../domain/ports/TemplateCachePort';
import { LoggerPort } from '../../../domain/ports/LoggerPort';

export class TemplateCacheAdapter implements TemplateCachePort {
  private readonly templatesDir: string;
  private readonly cacheFile: string;

  constructor(
    memoryPath: string,
    workspacePath: string,
    private readonly logger: LoggerPort
  ) {
    this.templatesDir = path.join(memoryPath, '!!config', 'templates');
    this.cacheFile = path.join(workspacePath, 'templates.json');

    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }
  }

  public async buildCache(): Promise<TemplateInfo[]> {
    if (!fs.existsSync(this.templatesDir)) {
      this.logger.warn(`Templates directory not found: ${this.templatesDir}`);
      return [];
    }

    const files = this.listMarkdownFiles(this.templatesDir);
    const templates: TemplateInfo[] = [];

    for (const filePath of files) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(raw);

        const description = parsed.data['!!description'];

        // Only add to cache if it has a description
        if (description && typeof description === 'string') {
          // Store path relative to !!config/templates or MEMORY_PATH
          const relativePath = path.relative(this.templatesDir, filePath);
          templates.push({
            template: relativePath,
            description: description.trim()
          });
        }
      } catch (e) {
        this.logger.error(`Error processing template ${filePath}: ${e}`);
      }
    }

    // Write to templates.json
    fs.writeFileSync(this.cacheFile, JSON.stringify(templates, null, 2), 'utf-8');
    return templates;
  }

  public async getCachedTemplates(): Promise<TemplateInfo[]> {
    if (!fs.existsSync(this.cacheFile)) {
      return this.buildCache();
    }

    try {
      const content = fs.readFileSync(this.cacheFile, 'utf-8');
      return JSON.parse(content) as TemplateInfo[];
    } catch (e) {
      this.logger.error(`Error reading templates cache. Rebuilding... ${e}`);
      return this.buildCache();
    }
  }

  private listMarkdownFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        results.push(...this.listMarkdownFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  }
}
