import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { Pool } from 'pg';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { TaskWorkerService } from '../services/TaskWorkerService';
import { PgTaskQueueAdapter } from '../OutAdapters/Database/PgTaskQueueAdapter';
import { PgVectorDbAdapter } from '../OutAdapters/Database/PgVectorDbAdapter';
import { FileSystemNoteRepositoryAdapter } from '../OutAdapters/Memory/FileSystemNoteRepositoryAdapter';
import { SyncMemoryUseCase } from '../../application/UseCases/SyncMemoryUseCase';
import { ProcessSystemTaskUseCase } from '../../application/UseCases/ProcessSystemTaskUseCase';
import { ProcessInboxUseCase } from '../../application/UseCases/ProcessInboxUseCase';
import path from 'path';
import fs from 'fs';
import { TemplateCacheAdapter } from '../OutAdapters/Memory/TemplateCacheAdapter';
import { VercelAIAdapter } from '../OutAdapters/VercelAI/VercelAIAdapter';
import { PersonasNoteOrganizer } from '../../application/services/PersonasNoteOrganizer';
import { ApplyTemplateAIUseCase } from '../../application/UseCases/ApplyTemplateAIUseCase';
import { GoogleImageSearchAdapter } from '../OutAdapters/Google/GoogleImageSearchAdapter';
import { GoogleWebSearchAdapter } from '../OutAdapters/Google/GoogleWebSearchAdapter';
import { RouteChatMessageUseCase } from '../../application/UseCases/RouteChatMessageUseCase';
import { GenerateNoteAIUseCase } from '../../application/UseCases/GenerateNoteAIUseCase';
import { MasterConversationGraph } from '../OutAdapters/LangGraph/MasterConversationGraph';
import { CacheTemplatesUseCase } from '../../application/UseCases/CacheTemplatesUseCase';
import { GeminiMultimodalLiveAdapter } from '../OutAdapters/Google/GeminiMultimodalLiveAdapter';
import { LiveVoiceChatUseCase } from '../../application/UseCases/LiveVoiceChatUseCase';
import { GoogleMapsGeocodingAdapter } from '../OutAdapters/Google/GoogleMapsAdapter';
import { TaskType } from '../../domain/ports/TaskQueuePort';
import { PgChatSessionRepositoryAdapter } from '../OutAdapters/Database/PgChatSessionRepositoryAdapter';
import { LATEST_DB_VERSION } from '../Config/DbVersion';

export class FastifyServer {
  private app: FastifyInstance;
  private pool: Pool | null = null;
  private logger: LoggerPort;

  // Singleton Adapters & Use Cases
  private taskQueue: PgTaskQueueAdapter | null = null;
  private chatSessionRepo: PgChatSessionRepositoryAdapter | null = null;
  private vectorDb: PgVectorDbAdapter | null = null;
  private baseLLM: any = null;
  private masterGraph: MasterConversationGraph | null = null;
  private generateNoteAI: GenerateNoteAIUseCase | null = null;

  constructor(logger: LoggerPort) {
    this.logger = logger;
    this.app = Fastify({
      logger: false, // We'll handle logging via our adapter and hooks if needed
    });

    this.app.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });

    this.app.register(websocket);

    this.app.addHook('preHandler', async (request, reply) => {
      // Allow unrestricted access to health check or OPTIONS requests AND playground UI
      if (request.url === '/health' || request.method === 'OPTIONS' || request.url.startsWith('/agent/playground')) {
        return;
      }

      const expectedToken = process.env.SERVER_AUTH_TOKEN || process.env.ELO_API_KEY;

      // If no token is configured on the server, we might want to warn or deny.
      // Assuming a token is REQUIRED for it to be secure:
      if (!expectedToken) {
        reply.code(500).send({ detail: "Server misconfiguration: SERVER_AUTH_TOKEN or ELO_API_KEY is missing." });
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({ detail: "Unauthorized: Missing authentication token." });
        return;
      }

      const token = authHeader.split(' ')[1];
      if (token !== expectedToken) {
        this.logger.warn(`[Auth] Forbidden: Invalid authentication token from ${request.ip}`);
        reply.code(403).send({ detail: "Forbidden: Invalid authentication token." });
        return;
      }
      this.logger.info(`[Auth] Request authorized for ${request.url}`);
    });

    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    const servePlayground = async (request: any, reply: any) => {
      const fs = await import('fs');
      const path = await import('path');
      const htmlPath = path.join(__dirname, 'playground.html');

      try {
        const html = fs.readFileSync(htmlPath, 'utf8');
        reply.type('text/html; charset=utf-8').send(html);
      } catch (e: any) {
        reply.status(500).send({ detail: "Playground HTML file not found: " + e.message });
      }
    };

    this.app.get('/agent/playground', servePlayground);
    this.app.get('/agent/playground/', servePlayground);

    this.app.post('/api/ai/generate', async (request, reply) => {
      const body = request.body as any;
      const prompt = body.prompt;
      let modelName = body.model_name;
      const jsonMode = body.json_mode || false;
      const temperature = body.temperature ?? 0.4;

      if (!modelName) {
        modelName = process.env.BASIC_AI_MODEL;
      }

      if (!modelName) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const configPath = path.join(process.env.ELO_WORKSPACE_PATH!, 'elo-config.json');
          if (fs.existsSync(configPath)) {
            const configStr = fs.readFileSync(configPath, 'utf8');
            const sanitizedStr = configStr.replace(/,\s*([\]}])/g, '$1');
            const configJson = JSON.parse(sanitizedStr);
            if (configJson?.ai?.model) {
              modelName = configJson.ai.model;
            }
          }
        } catch (e) {
          // fallback ignores error
        }
        if (!modelName) modelName = 'gpt-4o';
      }

      try {
        const { VercelAIAdapter } = await import('../OutAdapters/VercelAI/VercelAIAdapter');
        const adapter = new VercelAIAdapter(modelName);

        let systemPrompt = '';
        if (jsonMode) {
          systemPrompt = 'You must respond in valid JSON format.';
        }

        const response = await adapter.ask({
          messages: [{ role: 'user', content: prompt }],
          systemPrompt: systemPrompt
        });

        return { response: response.content };
      } catch (e: any) {
        reply.status(500).send({ detail: e.message });
      }
    });

    this.app.post('/api/templates/apply', async (request, reply) => {
      const body = request.body as any;
      const targetNotePath = body.targetNotePath;
      const templateId = body.templateId;
      const promptUrl = body.promptUrl;

      if (!targetNotePath) {
        reply.status(400).send({ detail: "targetNotePath is required" });
        return;
      }

      try {
        const memoryPath = process.env.MEMORY_PATH;
        const workspacePath = process.env.ELO_WORKSPACE_PATH;
        if (!memoryPath || !workspacePath) {
          reply.status(500).send({ detail: "Missing MEMORY_PATH or ELO_WORKSPACE_PATH" });
          return;
        }


        let modelName = process.env.BASIC_AI_MODEL || 'gpt-4o';
        try {
          const fs = await import('fs');
          const path = await import('path');
          const configPath = path.join(workspacePath, 'elo-config.json');
          if (fs.existsSync(configPath)) {
            const configStr = fs.readFileSync(configPath, 'utf8');
            const sanitizedStr = configStr.replace(/,\s*([\]}])/g, '$1');
            const configJson = JSON.parse(sanitizedStr);
            if (configJson?.ai?.model) {
              modelName = configJson.ai.model;
            }
          }
        } catch (e) {
          // ignore
        }

        const noteRepo = new FileSystemNoteRepositoryAdapter(memoryPath, this.logger);
        const templateCache = new TemplateCacheAdapter(memoryPath, workspacePath, this.logger);
        const llm = new VercelAIAdapter(modelName);
        const organizer = new PersonasNoteOrganizer(noteRepo);
        const imageSearch = new GoogleImageSearchAdapter(
          process.env.GOOGLE_SEARCH_API_KEY || '',
          process.env.GOOGLE_SEARCH_ENGINE_ID || ''
        );

        const useCase = new ApplyTemplateAIUseCase(noteRepo, templateCache, llm, imageSearch, organizer, this.logger);

        const result = await useCase.execute({
          targetNotePath,
          templateId,
          promptUrl
        });

        reply.send(result);
      } catch (e: any) {
        this.logger.error(`Error in /api/templates/apply: ${e.message}`);
        reply.status(500).send({ detail: e.message });
      }
    });

    this.app.get('/api/config', async (request, reply) => {
      return { user: {}, obsidian: {} };
    });

    this.app.get('/api/config/json', async (request, reply) => {
      const fs = await import('fs');
      const path = await import('path');
      const configPath = path.join(process.env.ELO_WORKSPACE_PATH!, 'elo-config.json');
      if (fs.existsSync(configPath)) {
        try {
          const configStr = fs.readFileSync(configPath, 'utf8');
          // Sanitize trailing commas before parsing
          const sanitizedStr = configStr.replace(/,\s*([\]}])/g, '$1');
          const configJson = JSON.parse(sanitizedStr);

          if (!configJson.myWorldPath) {
            configJson.myWorldPath = {
              placesTagsNameStart: "Lugares/"
            };
          }
          return configJson;
        } catch (e: any) {
          reply.status(500).send({ detail: "Error parsing elo-config.json: " + e.message });
          return;
        }
      }
      reply.status(404).send({ detail: "Config file not found" });
    });

    this.app.post('/api/memory/init', async (request, reply) => {
      const body = request.body as any;
      const lang = body.language === 'en' ? 'en' : 'es';
      const fs = await import('fs');
      const path = await import('path');

      const sourceDir = path.join(process.cwd(), 'assets/memory-init', `${lang}-metadata`);
      const targetDir = path.join(process.env.MEMORY_PATH || '', '!!config');

      if (!fs.existsSync(sourceDir)) {
        reply.status(404).send({ detail: `Memory templates for language '${lang}' not found` });
        return;
      }

      if (process.env.MEMORY_PATH) {
        fs.cpSync(sourceDir, targetDir, { recursive: true });
        return { message: `Memory successfully initialized with '${lang}' templates.`, target_path: targetDir };
      }

      reply.status(400).send({ detail: "MEMORY_PATH is not configured." });
    });

    this.app.post('/ask', async (request, reply) => {
      process.stdout.write(`\n[TRACER] Incoming request: POST /ask from ${request.ip}\n`);
      const body = request.body as any;
      try {
        if (!this.masterGraph || !this.chatSessionRepo) {
          reply.status(503).send({ detail: 'Server is still initializing AI or Database components.' });
          return;
        }

        const userId = body.user_id || (request.headers['x-user-id'] as string) || 'anonymous';
        const useCase = new RouteChatMessageUseCase(this.masterGraph, this.chatSessionRepo, this.logger);

        const result = await useCase.execute({ message: body.prompt, userId });
        console.log(`[FastifyServer] /ask Result:`, JSON.stringify(result));
        return { response: result.response, intent: result.intent };
      } catch (e: any) {
        this.logger.error(`[FastifyServer] Error in /ask: ${e.message}`, { stack: e.stack });
        reply.status(500).send({ detail: e.message });
      }
    });

    this.app.post('/api/geocode', async (request, reply) => {
      const body = request.body as any;
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
        const adapter = new GoogleMapsGeocodingAdapter(apiKey);
        const results = await adapter.geocode(body.place_name, body.place_id, body.language || 'es');
        return { results };
      } catch (e: any) {
        reply.status(500).send({ detail: e.message });
      }
    });

    this.app.post('/api/memory/sync-note', async (request, reply) => {
      const body = request.body as any;
      const notePath = body.path;

      if (!notePath) {
        reply.status(400).send({ detail: "notePath is required" });
        return;
      }

      try {
        const { PgTaskQueueAdapter } = await import('../OutAdapters/Database/PgTaskQueueAdapter');
        const { TaskType } = await import('../../domain/ports/TaskQueuePort');

        const taskQueue = new PgTaskQueueAdapter(process.env.DATABASE_URL || '', this.logger);
        await taskQueue.init();

        await taskQueue.enqueue({
          payload: { type: TaskType.ReindexNote, notePath }
        });

        await taskQueue.close();
        reply.status(202).send({ status: "accepted", notePath });
      } catch (e: any) {
        this.logger.error(`Error in /api/memory/sync-note: ${e.message}`);
        reply.status(500).send({ detail: e.message });
      }
    });

    // Placeholders for advanced AI tools
    this.app.post('/api/ai/vision', async (request, reply) => {
      reply.status(501).send({ detail: "Vision API not implemented in TS yet" });
    });
    this.app.post('/api/ai/transcribe', async (request, reply) => {
      reply.status(501).send({ detail: "Audio transcription API not implemented in TS yet" });
    });
    this.app.post('/api/ai/image-search', async (request, reply) => {
      reply.status(501).send({ detail: "Image search API not implemented in TS yet" });
    });

    // Gemini Multimodal Live WebSocket Route
    this.app.get('/ws/voice', { websocket: true }, async (connection: any, request) => {
      const socket = connection.socket as WebSocket;
      this.logger.info('New WebSocket connection for Gemini Live');

      try {
        const { GeminiMultimodalLiveAdapter } = await import('../OutAdapters/Google/GeminiMultimodalLiveAdapter');
        const { LiveVoiceChatUseCase } = await import('../../application/UseCases/LiveVoiceChatUseCase');

        const apiKey = process.env.GOOGLE_AI_API_KEY || '';
        const voicePort = new GeminiMultimodalLiveAdapter(apiKey, this.logger);
        const useCase = new LiveVoiceChatUseCase(voicePort, this.logger);

        const geminiSession = await useCase.execute({
          model: 'gemini-2.0-flash-exp',
          systemInstruction: 'You are a helpful assistant. You can launch background tasks when requested.',
          tools: [
            {
              name: "summarizeRecentNotes",
              description: "Summarizes the most recent notes in the memory.",
              parameters: {
                type: "object",
                properties: {
                  count: { type: "number", description: "Number of notes to summarize" }
                }
              }
            }
          ]
        });

        // Forward audio from Obsidian to Gemini
        socket.on('message', (message: any) => {
          // Handle audio chunks or text commands from client
          if (Buffer.isBuffer(message)) {
            geminiSession.sendAudio(message);
          } else {
            const str = message.toString();
            try {
              const json = JSON.parse(str);
              if (json.type === 'audio') {
                geminiSession.sendAudio(Buffer.from(json.data, 'base64'));
              } else if (json.type === 'text') {
                geminiSession.sendText(json.text);
              }
            } catch (e) {
              geminiSession.sendText(str);
            }
          }
        });

        // Forward audio/text from Gemini to Obsidian
        geminiSession.onAudio((chunk: Buffer) => {
          socket.send(JSON.stringify({ type: 'audio', data: chunk.toString('base64') }));
        });

        geminiSession.onText((text: string) => {
          socket.send(JSON.stringify({ type: 'text', text }));
        });

        socket.on('close', () => {
          this.logger.info('Obsidian WebSocket connection closed');
          geminiSession.close();
        });

      } catch (err: any) {
        this.logger.error(`Error in /ws/voice: ${err.message}`);
        socket.close();
      }
    });
  }

  private async startTaskWorker(): Promise<void> {
    const memoryPath = process.env.MEMORY_PATH;
    const dbUrl = process.env.DATABASE_URL || '';
    const googleApiKey = process.env.GOOGLE_AI_API_KEY || '';
    const workspacePath = process.env.ELO_WORKSPACE_PATH || '';

    if (!memoryPath || !dbUrl) {
      this.logger.warn('[FastifyServer] Skipping TaskWorker startup: MEMORY_PATH or DATABASE_URL missing.');
      return;
    }

    try {
      if (!this.pool) {
        this.logger.error('[FastifyServer] Database pool not initialized in startTaskWorker.');
        return;
      }

      // 1. Repository & Adapters
      const noteRepo = new FileSystemNoteRepositoryAdapter(memoryPath, this.logger);
      const vectorDb = new PgVectorDbAdapter({
        pool: this.pool,
        apiKey: googleApiKey,
      });
      const taskQueue = new PgTaskQueueAdapter(this.pool, this.logger);

      await vectorDb.init();
      await taskQueue.init();

      // 2. Use Cases & Services
      const configPath = path.join(workspacePath, 'elo-config.json');
      let worldPath = 'Mi mundo';
      if (fs.existsSync(configPath)) {
        try {
          const configJson = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/,\s*([\]}])/g, '$1'));
          worldPath = configJson.memory?.worldPath || configJson.myWorldPath?.worldMemoryPath || 'Mi mundo';
        } catch (e) { }
      }

      const llm = new VercelAIAdapter(process.env.BASIC_AI_MODEL || 'gpt-4o');
      const templateCache = new TemplateCacheAdapter(memoryPath, workspacePath, this.logger);
      const organizer = new PersonasNoteOrganizer(noteRepo);
      const imageSearch = new GoogleImageSearchAdapter(
        process.env.GOOGLE_SEARCH_API_KEY || '',
        process.env.GOOGLE_SEARCH_ENGINE_ID || ''
      );

      const syncMemoryUseCase = new SyncMemoryUseCase(noteRepo, vectorDb, this.logger, {
        worldPath: worldPath
      });
      const applyTemplateAI = new ApplyTemplateAIUseCase(noteRepo, templateCache, llm, imageSearch, organizer, this.logger);

      const webSearch = new GoogleWebSearchAdapter(
        process.env.GOOGLE_SEARCH_API_KEY || '',
        process.env.GOOGLE_SEARCH_ENGINE_ID || ''
      );

      let workerBaseLLM: any;
      const modelName = process.env.BASIC_AI_MODEL || 'gemini-2.0-flash';
      if (modelName.includes('gemini') || modelName.includes('google')) {
        workerBaseLLM = new ChatGoogleGenerativeAI({
          model: modelName,
          temperature: 0.2,
          apiKey: process.env.GOOGLE_AI_API_KEY,
        });
      } else {
        workerBaseLLM = new ChatOpenAI({
          modelName: modelName,
          temperature: 0.2,
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
      }

      const processInbox = new ProcessInboxUseCase(noteRepo, templateCache, workerBaseLLM, webSearch, taskQueue, this.logger);

      const processUseCase = new ProcessSystemTaskUseCase(
        taskQueue,
        syncMemoryUseCase,
        applyTemplateAI,
        processInbox,
        this.logger
      );

      // 3. Worker - run in background
      const worker = new TaskWorkerService(taskQueue, processUseCase, this.logger);
      worker.start().catch((err: any) => {
        this.logger.error(`[FastifyServer] TaskWorker crashed: ${err.message}`);
      });
      this.logger.info('[FastifyServer] TaskWorker started successfully.');
    } catch (error: any) {
      this.logger.error(`[FastifyServer] Failed to start TaskWorker: ${error.message}`);
    }
  }

  public async start(port: number = 3000): Promise<void> {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20, // Limit connections to prevent exhaustion
    });
    console.log('[DEBUG] Shared Database Pool instance created.');
    this.logger.info('[FastifyServer] Shared Database Pool initialized.');

    if (!process.env.BASIC_AI_MODEL) {
      console.log('DEBUG: BASIC_AI_MODEL is missing!');
      this.app.log.error("FATAL ERROR: BASIC_AI_MODEL environment variable is required but not configured.");
      process.exit(1);
    }
    console.log('DEBUG: BASIC_AI_MODEL found:', process.env.BASIC_AI_MODEL);

    if (!process.env.ELO_WORKSPACE_PATH) {
      console.log('DEBUG: ELO_WORKSPACE_PATH is missing!');
      this.app.log.error("FATAL ERROR: ELO_WORKSPACE_PATH environment variable is required but not configured.");
      process.exit(1);
    }
    console.log('DEBUG: ELO_WORKSPACE_PATH found:', process.env.ELO_WORKSPACE_PATH);

    try {
      // 1. Initialize Singleton Adapters & AI Graph
      const memoryPath = process.env.MEMORY_PATH;
      const workspacePath = process.env.ELO_WORKSPACE_PATH;
      if (!memoryPath || !workspacePath) {
        throw new Error('MEMORY_PATH or ELO_WORKSPACE_PATH is not configured.');
      }

      // DB VERSION GUARD
      const configPath = path.join(workspacePath, 'elo-config.json');
      let currentDbVersion = 0;
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        currentDbVersion = config.dbVersion || 0;
      }

      if (currentDbVersion < LATEST_DB_VERSION) {
        const errorMsg = `[FATAL] Database version mismatch! (Code: ${LATEST_DB_VERSION}, Config: ${currentDbVersion}).\n\nPlease run 'elo server update' to migrate the database schema before starting the server.`;
        this.logger.error(errorMsg);
        process.exit(1);
      }

      this.logger.info('[FastifyServer] Initializing shared adapters...');

      this.taskQueue = new PgTaskQueueAdapter(this.pool!, this.logger);
      await this.taskQueue.init();

      this.chatSessionRepo = new PgChatSessionRepositoryAdapter(this.pool!);
      await this.chatSessionRepo.init();

      this.vectorDb = new PgVectorDbAdapter({
        pool: this.pool!,
        apiKey: process.env.GOOGLE_AI_API_KEY || '',
      });

      const modelName = process.env.BASIC_AI_MODEL || 'gemini-2.0-flash';
      if (modelName.includes('gemini') || modelName.includes('google')) {
        this.baseLLM = new ChatGoogleGenerativeAI({
          model: modelName,
          temperature: 0.2,
          apiKey: process.env.GOOGLE_AI_API_KEY,
        });
      } else {
        this.baseLLM = new ChatOpenAI({
          modelName: modelName,
          temperature: 0.2,
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
      }

      const noteRepo = new FileSystemNoteRepositoryAdapter(memoryPath, this.logger);
      const templateCache = new TemplateCacheAdapter(memoryPath, workspacePath, this.logger);
      const llm = new VercelAIAdapter(process.env.BASIC_AI_MODEL || 'gpt-4o');
      const organizer = new PersonasNoteOrganizer(noteRepo);
      const imageSearch = new GoogleImageSearchAdapter(
        process.env.GOOGLE_SEARCH_API_KEY || '',
        process.env.GOOGLE_SEARCH_ENGINE_ID || ''
      );
      const applyTemplateAI = new ApplyTemplateAIUseCase(noteRepo, templateCache, llm, imageSearch, organizer, this.logger);

      this.generateNoteAI = new GenerateNoteAIUseCase(
        templateCache,
        noteRepo,
        this.vectorDb,
        this.taskQueue,
        applyTemplateAI,
        this.logger,
        this.baseLLM
      );

      const webSearch = new GoogleWebSearchAdapter(
        process.env.GOOGLE_SEARCH_API_KEY || '',
        process.env.GOOGLE_SEARCH_ENGINE_ID || ''
      );
      this.masterGraph = new MasterConversationGraph(this.baseLLM, this.vectorDb, webSearch, this.generateNoteAI, this.logger);

      this.logger.info('[FastifyServer] Server components initialized successfully.');

      // 2. Run Task Worker in background (don't await)
      this.startTaskWorker().catch((err: any) => {
        this.logger.error(`[FastifyServer] startTaskWorker error: ${err.message}`);
      });

      // 3. Schedule periodic inbox processing (every 5 minutes)
      if (this.taskQueue) {
        setInterval(async () => {
          try {
            await this.taskQueue!.enqueue({ payload: { type: TaskType.ProcessInbox } });
          } catch (e: any) {
            this.logger.error(`[FastifyServer] Failed to schedule ProcessInbox task: ${e.message}`);
          }
        }, 5 * 60 * 1000); // 5 minutes
      }

      // Run template caching in background (don't await)
      if (process.env.MEMORY_PATH && process.env.ELO_WORKSPACE_PATH) {
        (async () => {
          try {
            const { TemplateCacheAdapter } = await import('../OutAdapters/Memory/TemplateCacheAdapter');
            const { CacheTemplatesUseCase } = await import('../../application/UseCases/CacheTemplatesUseCase');
            const templateCacheAdapter = new TemplateCacheAdapter(process.env.MEMORY_PATH!, process.env.ELO_WORKSPACE_PATH!, this.logger);
            const cacheUseCase = new CacheTemplatesUseCase(templateCacheAdapter, this.logger);
            await cacheUseCase.execute();
          } catch (cacheErr: any) {
            this.logger.warn(`Failed to build template cache on startup: ${cacheErr.message}`);
          }
        })();
      }

      console.log('DEBUG: About to call app.listen with port:', port);
      await this.app.listen({ port, host: '0.0.0.0' });
      console.log('DEBUG: app.listen() completed successfully');
      this.logger.info(`Server listening at http://localhost:${port}`);
    } catch (err: any) {
      console.error('DEBUG: Error in start():', err);
      this.app.log.error(err);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    await this.app.close();
  }
}
