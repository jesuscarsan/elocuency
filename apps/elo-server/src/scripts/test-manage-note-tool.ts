import { ManageNoteTool } from '../infrastructure/tools/ManageNoteTool';
import { FileSystemNoteRepositoryAdapter } from '../infrastructure/OutAdapters/Memory/FileSystemNoteRepositoryAdapter';
import { PgTaskQueueAdapter } from '../infrastructure/OutAdapters/Database/PgTaskQueueAdapter';
import { ApplyTemplateAIUseCase } from '../application/UseCases/ApplyTemplateAIUseCase';
import { TemplateCacheAdapter } from '../infrastructure/OutAdapters/Memory/TemplateCacheAdapter';
import { VercelAIAdapter } from '../infrastructure/OutAdapters/VercelAI/VercelAIAdapter';
import { PersonasNoteOrganizer } from '../application/services/PersonasNoteOrganizer';
import { GoogleImageSearchAdapter } from '../infrastructure/OutAdapters/Google/GoogleImageSearchAdapter';
import { WinstonLoggerAdapter } from '../infrastructure/logging/WinstonLoggerAdapter';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

async function testManageNoteTool() {
  const logger = new WinstonLoggerAdapter('test-manage-note');
  const memoryPath = process.env.MEMORY_PATH;
  const workspacePath = process.env.ELO_WORKSPACE_PATH;

  if (!memoryPath || !workspacePath) {
    console.error('MEMORY_PATH or ELO_WORKSPACE_PATH is not set.');
    return;
  }

  const noteRepo = new FileSystemNoteRepositoryAdapter(memoryPath, logger);
  const taskQueue = new PgTaskQueueAdapter(process.env.DATABASE_URL || '', logger);
  const templateCache = new TemplateCacheAdapter(memoryPath, workspacePath, logger);
  const llm = new VercelAIAdapter(process.env.BASIC_AI_MODEL || 'gemini-2.0-flash');
  const organizer = new PersonasNoteOrganizer(noteRepo);
  const imageSearch = new GoogleImageSearchAdapter('', '');

  const applyTemplateUseCase = new ApplyTemplateAIUseCase(
    noteRepo,
    templateCache,
    llm,
    imageSearch,
    organizer,
    logger
  );

  const tool = new ManageNoteTool(
    noteRepo,
    taskQueue,
    applyTemplateUseCase,
    logger,
    memoryPath
  );

  console.log('--- TEST 1: New Note Creation in !!archive ---');
  const result1 = await tool.call({
    title: 'Test Manage Note Tool',
    content: 'This is a test note created by the tool.',
    frontmatter: { tags: ['Test'] }
  });
  console.log('Result 1:', result1);

  console.log('\n--- TEST 2: Existing Note Update (Case-Insensitive) ---');
  const result2 = await tool.call({
    title: 'test manage note tool', // lowercase
    content: 'This updated content should overwrite the previous version.',
    frontmatter: { status: 'Updated' }
  });
  console.log('Result 2:', result2);

  // We are not calling taskQueue.init() because this is a script, but we should verify the signal is sent.
  // The tool calls enqueue, which is fine as long as connection string is valid.
}

testManageNoteTool().then(() => console.log('Done.')).catch(console.error);
