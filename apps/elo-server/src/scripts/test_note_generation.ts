import { config } from 'dotenv';
import { TemplateCacheAdapter } from '../infrastructure/OutAdapters/Memory/TemplateCacheAdapter';
import { LangChainNoteGeneratorAdapter } from '../infrastructure/OutAdapters/LangChainNoteGeneratorAdapter';
import { FileSystemNoteRepositoryAdapter } from '../infrastructure/OutAdapters/Memory/FileSystemNoteRepositoryAdapter';
import { CacheTemplatesUseCase } from '../application/UseCases/CacheTemplatesUseCase';
import { GenerateNoteUseCase } from '../application/UseCases/GenerateNoteUseCase';
import { WinstonLoggerAdapter } from '../infrastructure/logging/WinstonLoggerAdapter';
import * as path from 'path';

// Load ENV from elocuency root
config({ path: path.join(__dirname, '../../../../.env') });

async function verify() {
  const memoryPath = process.env.MEMORY_PATH!;
  const workspacePath = process.env.ELO_WORKSPACE_PATH!;

  console.log(`Memory Path: ${memoryPath}`);
  console.log(`Workspace Path: ${workspacePath}`);

  const logger = new WinstonLoggerAdapter('test-note-gen');

  // Init Adapters
  const templateCacheAdapter = new TemplateCacheAdapter(memoryPath, workspacePath, logger);
  const noteRepoAdapter = new FileSystemNoteRepositoryAdapter(memoryPath, logger);
  const llmAdapter = new LangChainNoteGeneratorAdapter();

  // Init UseCases
  const cacheTemplatesUseCase = new CacheTemplatesUseCase(templateCacheAdapter, logger);
  const generateNoteUseCase = new GenerateNoteUseCase(llmAdapter, templateCacheAdapter, noteRepoAdapter, logger);

  // 1. Build Cache
  console.log('\n--- 1. Testing CacheTemplatesUseCase ---');
  await cacheTemplatesUseCase.execute();

  // 2. Generate Note
  console.log('\n--- 2. Testing GenerateNoteUseCase ---');
  const prompt = 'Quiero reseñar la película de ciencia ficción Matrix del año 1999. Fue dirigida por las hermanas Wachowski. Le daría 5 estrellas sin dudarlo, es mi película favorita.';
  console.log(`Prompt: "${prompt}"`);
  
  try {
    const note = await generateNoteUseCase.execute(prompt);
    if (note) {
      console.log(`\n✅ Generated successfully: ${note.id}`);
      console.log('--- Content ---');
      console.log(note.content);
    } else {
      console.log('❌ Failed to generate note (no template found).');
    }
  } catch (err) {
    console.error('❌ Error generating note:', err);
  }
}

verify().catch(console.error);
