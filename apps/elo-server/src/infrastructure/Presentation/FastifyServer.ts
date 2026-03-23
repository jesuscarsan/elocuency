import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export class FastifyServer {
  private app: FastifyInstance;

  constructor() {
    this.app = Fastify({
      logger: true,
    });

    this.app.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });

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
          const configPath = process.env.ELO_WORKSPACE_PATH 
            ? path.join(process.env.ELO_WORKSPACE_PATH, 'elo-config.json')
            : path.join(process.cwd(), '../../elo-workspace/elo-config.json');
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

    this.app.get('/api/config', async (request, reply) => {
      return { user: {}, obsidian: {} };
    });

    this.app.get('/api/config/json', async (request, reply) => {
      const fs = await import('fs');
      const path = await import('path');
      const configPath = process.env.ELO_WORKSPACE_PATH 
        ? path.join(process.env.ELO_WORKSPACE_PATH, 'elo-config.json')
        : path.join(process.cwd(), '../../elo-workspace/elo-config.json');
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

    this.app.post('/api/vault/init', async (request, reply) => {
      const body = request.body as any;
      const lang = body.language === 'en' ? 'en' : 'es';
      const fs = await import('fs');
      const path = await import('path');
      
      const sourceDir = path.join(process.cwd(), '../../setup/vault-init', `${lang}-metadata`);
      const targetDir = path.join(process.env.VAULT_PATH || '', '!!metadata');
      
      if (!fs.existsSync(sourceDir)) {
        reply.status(404).send({ detail: `Vault templates for language '${lang}' not found` });
        return;
      }
      
      if (process.env.VAULT_PATH) {
        fs.cpSync(sourceDir, targetDir, { recursive: true });
        return { message: `Vault successfully initialized with '${lang}' templates.`, target_path: targetDir };
      }
      
      reply.status(400).send({ detail: "VAULT_PATH is not configured." });
    });

    this.app.post('/ask', async (request, reply) => {
      const body = request.body as any;
      try {
        const { LangChainIntentAnalyzerAdapter } = await import('../OutAdapters/LangChainIntentAnalyzerAdapter');
        const { LangChainSpecialistProcessorAdapter } = await import('../OutAdapters/LangChainSpecialistProcessorAdapter');
        const { RouteChatMessageUseCase } = await import('../../application/UseCases/RouteChatMessageUseCase');
        const { FileSystemNoteRepositoryAdapter } = await import('../OutAdapters/Vault/FileSystemNoteRepositoryAdapter');
        const { PgVectorDbAdapter } = await import('../OutAdapters/Database/PgVectorDbAdapter');
        const { SyncVaultUseCase } = await import('../../application/UseCases/SyncVaultUseCase');

        const vaultPath = process.env.VAULT_PATH;
        if (!vaultPath) {
          reply.status(500).send({ detail: 'VAULT_PATH environment variable is not configured.' });
          return;
        }

        const noteRepo = new FileSystemNoteRepositoryAdapter(vaultPath);

        const vectorDb = new PgVectorDbAdapter({
          connectionString: process.env.DATABASE_URL || '',
          apiKey: process.env.GOOGLE_AI_API_KEY || '',
        });

        const syncVault = new SyncVaultUseCase(noteRepo, vectorDb);

        const intentAnalyzer = new LangChainIntentAnalyzerAdapter();
        const specialistProcessor = new LangChainSpecialistProcessorAdapter(syncVault, vectorDb);
        const useCase = new RouteChatMessageUseCase(intentAnalyzer, specialistProcessor);
        
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
  }

  public async start(port: number = 3000): Promise<void> {
    if (!process.env.BASIC_AI_MODEL) {
      this.app.log.error("FATAL ERROR: BASIC_AI_MODEL environment variable is required but not configured.");
      process.exit(1);
    }
    
    try {
      await this.app.listen({ port, host: '0.0.0.0' });
      console.log(`Server listening at http://localhost:${port}`);
    } catch (err) {
      this.app.log.error(err);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    await this.app.close();
  }
}
