import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { LoggerPort } from '../../domain/ports/LoggerPort';

export class FastifyServer {
  private app: FastifyInstance;
  private logger: LoggerPort;

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
        reply.code(403).send({ detail: "Forbidden: Invalid authentication token." });
        return;
      }
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

        const { FileSystemNoteRepositoryAdapter } = await import('../OutAdapters/Memory/FileSystemNoteRepositoryAdapter');
        const { TemplateCacheAdapter } = await import('../OutAdapters/Memory/TemplateCacheAdapter');
        const { VercelAIAdapter } = await import('../OutAdapters/VercelAI/VercelAIAdapter');
        const { PersonasNoteOrganizer } = await import('../../application/services/PersonasNoteOrganizer');
        const { ApplyTemplateUseCase } = await import('../../application/UseCases/ApplyTemplateUseCase');
        const { GoogleImageSearchAdapter } = await import('../OutAdapters/Google/GoogleImageSearchAdapter');
        
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

        const useCase = new ApplyTemplateUseCase(noteRepo, templateCache, llm, imageSearch, organizer, this.logger);

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
      const targetDir = path.join(process.env.MEMORY_PATH || '', '!!metadata');

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
      const body = request.body as any;
      try {
        const { LangChainIntentAnalyzerAdapter } = await import('../OutAdapters/LangChainIntentAnalyzerAdapter');
        const { LangChainSpecialistProcessorAdapter } = await import('../OutAdapters/LangChainSpecialistProcessorAdapter');
        const { RouteChatMessageUseCase } = await import('../../application/UseCases/RouteChatMessageUseCase');
        const { FileSystemNoteRepositoryAdapter } = await import('../OutAdapters/Memory/FileSystemNoteRepositoryAdapter');
        const { PgVectorDbAdapter } = await import('../OutAdapters/Database/PgVectorDbAdapter');
        const { SyncMemoryUseCase } = await import('../../application/UseCases/SyncMemoryUseCase');

        const memoryPath = process.env.MEMORY_PATH;
        if (!memoryPath) {
          reply.status(500).send({ detail: 'MEMORY_PATH environment variable is not configured.' });
          return;
        }

        const noteRepo = new FileSystemNoteRepositoryAdapter(memoryPath, this.logger);

        const vectorDb = new PgVectorDbAdapter({
          connectionString: process.env.DATABASE_URL || '',
          apiKey: process.env.GOOGLE_AI_API_KEY || '',
        });

        const syncMemory = new SyncMemoryUseCase(noteRepo, vectorDb, this.logger);

        const intentAnalyzer = new LangChainIntentAnalyzerAdapter(this.logger);
        const specialistProcessor = new LangChainSpecialistProcessorAdapter(syncMemory, vectorDb, this.logger);
        const useCase = new RouteChatMessageUseCase(intentAnalyzer, specialistProcessor, this.logger);

        const result = await useCase.execute({ message: body.prompt });

        await vectorDb.close();

        return { response: result.response, intent: result.intent };
      } catch (e: any) {
        reply.status(500).send({ detail: e.message });
      }
    });

    this.app.post('/api/geocode', async (request, reply) => {
      const body = request.body as any;
      try {
        const { GoogleMapsGeocodingAdapter } = await import('../OutAdapters/Google/GoogleMapsAdapter');
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
        const adapter = new GoogleMapsGeocodingAdapter(apiKey);
        const results = await adapter.geocode(body.place_name, body.place_id, body.language || 'es');
        return { results };
      } catch (e: any) {
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

  public async start(port: number = 3000): Promise<void> {
    if (!process.env.BASIC_AI_MODEL) {
      this.app.log.error("FATAL ERROR: BASIC_AI_MODEL environment variable is required but not configured.");
      process.exit(1);
    }

    if (!process.env.ELO_WORKSPACE_PATH) {
      this.app.log.error("FATAL ERROR: ELO_WORKSPACE_PATH environment variable is required but not configured.");
      process.exit(1);
    }

    try {
      // Run template caching on startup
      if (process.env.MEMORY_PATH) {
        try {
          const { TemplateCacheAdapter } = await import('../OutAdapters/Memory/TemplateCacheAdapter');
          const { CacheTemplatesUseCase } = await import('../../application/UseCases/CacheTemplatesUseCase');
          const templateCacheAdapter = new TemplateCacheAdapter(process.env.MEMORY_PATH, process.env.ELO_WORKSPACE_PATH, this.logger);
          const cacheUseCase = new CacheTemplatesUseCase(templateCacheAdapter, this.logger);
          await cacheUseCase.execute();
        } catch (cacheErr) {
          this.logger.warn(`Failed to build template cache on startup: ${cacheErr}`);
        }
      }

      await this.app.listen({ port, host: '0.0.0.0' });
      this.logger.info(`Server listening at http://localhost:${port}`);
    } catch (err) {
      this.app.log.error(err);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    await this.app.close();
  }
}
