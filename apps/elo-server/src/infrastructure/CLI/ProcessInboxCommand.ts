import { FileSystemNoteRepositoryAdapter } from '../OutAdapters/Memory/FileSystemNoteRepositoryAdapter';
import { TemplateCacheAdapter } from '../OutAdapters/Memory/TemplateCacheAdapter';
import { VercelAIAdapter } from '../OutAdapters/VercelAI/VercelAIAdapter';
import { GoogleWebSearchAdapter } from '../OutAdapters/Google/GoogleWebSearchAdapter';
import { ProcessInboxUseCase } from '../../application/UseCases/ProcessInboxUseCase';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '../../.env') });
dotenv.config(); // Also try local

const logger: LoggerPort = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  debug: (msg: string) => console.log(`[DEBUG] ${msg}`),
};

async function run() {
  const memoryPath = process.env.MEMORY_PATH;
  const workspacePath = process.env.ELO_WORKSPACE_PATH;

  if (!memoryPath || !workspacePath) {
    console.error('Missing MEMORY_PATH or ELO_WORKSPACE_PATH');
    process.exit(1);
  }

  const modelName = process.env.BASIC_AI_MODEL || 'gemini-2.0-flash';
  let baseLLM: any;

  if (modelName.includes('gemini') || modelName.includes('google')) {
    baseLLM = new ChatGoogleGenerativeAI({
      model: modelName,
      temperature: 0.2,
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });
  } else {
    baseLLM = new ChatOpenAI({
      modelName: modelName,
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  const noteRepo = new FileSystemNoteRepositoryAdapter(memoryPath, logger);
  const templateCache = new TemplateCacheAdapter(memoryPath, workspacePath, logger);
  const webSearch = new GoogleWebSearchAdapter(
    process.env.GOOGLE_SEARCH_API_KEY || '',
    process.env.GOOGLE_SEARCH_ENGINE_ID || ''
  );

  // Mock TaskQueue for one-off CLI run (if DB is down)
  const taskQueue: any = {
    enqueue: async (payload: any) => {
        console.log(`[CLI] Mock Enqueue task: ${JSON.stringify(payload)}`);
        return 'mock-task-id';
    }
  };

  const useCase = new ProcessInboxUseCase(
    noteRepo,
    templateCache,
    baseLLM,
    webSearch,
    taskQueue,
    logger
  );

  console.log('--- Starting Manual Inbox Process ---');
  await useCase.execute();
  console.log('--- Finished Manual Inbox Process ---');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
