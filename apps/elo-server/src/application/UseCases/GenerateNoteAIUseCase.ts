import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { TemplateCachePort } from '../../domain/ports/TemplateCachePort';
import { VectorDbPort } from '../../domain/ports/VectorDbPort';
import { TaskQueuePort, TaskType } from '../../domain/ports/TaskQueuePort';
import { ApplyTemplateAIUseCase } from './ApplyTemplateAIUseCase';
import { Note } from '../../domain/Entities/Note';
import { NoteCreatorGraph } from '../../infrastructure/OutAdapters/LangGraph/NoteCreatorGraph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { formatFrontmatterBlock } from '../../domain/Utils/FrontmatterUtils';

export interface GenerateNoteAIResponse {
  status: 'success' | 'needs_selection' | 'error';
  notes?: Note[];
  message?: string;
  traces?: string[];
}

export class GenerateNoteAIUseCase {
  constructor(
    private readonly templateCache: TemplateCachePort, // kept for backward compatibility with DI
    private readonly noteRepository: NoteRepositoryPort,
    private readonly vectorDb: VectorDbPort, // kept for backward compatibility
    private readonly taskQueue: TaskQueuePort, // kept for backward compatibility
    private readonly applyTemplateAI: ApplyTemplateAIUseCase, // kept for backward compatibility
    private readonly logger: LoggerPort,
    private readonly baseLLM: BaseChatModel
  ) {}

  private getDiaryPath(): string | null {
    try {
      const workspacePath = process.env.ELO_WORKSPACE_PATH || '';
      const configPath = path.join(workspacePath, 'elo-config.json');
      if (fs.existsSync(configPath)) {
        const configStr = fs.readFileSync(configPath, 'utf8').replace(/,\s*([\]}])/g, '$1');
        const config = JSON.parse(configStr);
        return config.diaryPath || null;
      }
    } catch (e: any) {
      this.logger.error(`Failed to read elo-config.json for diaryPath: ${e.message}`);
    }
    return null;
  }

  private async appendToDiaryNote(entry: string): Promise<void> {
    const diaryBasePath = this.getDiaryPath();
    if (!diaryBasePath) {
      this.logger.warn('diaryPath is not configured in elo-config.json. Skipping diary append.');
      return;
    }

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    
    // Absolute path based on diaryBasePath: diaryBasePath/year/month/year-month-day.md
    const diaryFilePath = path.join(diaryBasePath, year, month, `${year}-${month}-${day}.md`);
    
    const timeFormatted = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const entryText = `\n- ${timeFormatted} - ${entry}`;

    try {
      // Create directories if they don't exist
      fs.mkdirSync(path.dirname(diaryFilePath), { recursive: true });

      if (fs.existsSync(diaryFilePath)) {
        fs.appendFileSync(diaryFilePath, entryText);
        this.logger.info(`Appended entry to diary at ${diaryFilePath}`);
      } else {
        // If the daily note doesn't exist, create it with a basic template
        const initialContent = `---\ntags: [Diario]\n---\n# Diario de ${day}/${month}/${year}\n${entryText}\n`;
        fs.writeFileSync(diaryFilePath, initialContent);
        this.logger.info(`Created new daily note at ${diaryFilePath}`);
      }
    } catch (e: any) {
      this.logger.error(`Failed to append to diary note: ${e.message}`);
    }
  }

  public async execute(prompt: string, userId: string, selectedTemplate?: string): Promise<GenerateNoteAIResponse> {
    const threadId = userId;
    this.logger.info(`Processing fast diary generation for prompt: "${prompt}" (Thread: ${threadId})`);

    const graphBuilder = new NoteCreatorGraph(this.baseLLM, this.logger);
    const graph = graphBuilder.createGraph();
    const config = { configurable: { thread_id: threadId } };
    
    // Fresh start execute
    const result = await graph.invoke({
      originalPrompt: prompt,
      status: 'generating',
      diaryEntry: null,
      distilledFacts: null,
      history: [],
      errorMessage: null,
      traces: []
    }, config);

    return this.processGraphResult(result, prompt);
  }

  private async processGraphResult(result: any, originalPrompt: string): Promise<GenerateNoteAIResponse> {
    const traces = result.traces || [];

    if (result.status === 'error') {
      return { status: 'error', message: result.errorMessage || 'Unknown error occurred in Graph workflow.', traces };
    }

    if (result.status === 'success' && result.diaryEntry) {
      // 1. Append to Diary
      await this.appendToDiaryNote(result.diaryEntry);

      // 2. Save raw info to /Inbox
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}-${now.getMinutes().toString().padStart(2,'0')}-${now.getSeconds().toString().padStart(2,'0')}`;
      const inboxPath = `Inbox/Log-${timestamp}.md`;
      
      const properties = {
        status: "pending_processing"
      };

      const content = `${formatFrontmatterBlock(properties)}\n\nDistilled Facts:\n${result.distilledFacts}`;

      const draftNote = new Note(
        inboxPath,
        `Log-${timestamp}`,
        content,
        [],
        now,
        now,
        properties
      );

      await this.noteRepository.saveNote(draftNote);

      // Trigger background processing immediately
      await this.taskQueue.enqueue({ payload: { type: TaskType.ProcessInbox } });

      return { 
        status: 'success', 
        notes: [draftNote],
        message: `Registered entry in your diary. Background task will process the context later.`,
        traces
      };
    }

    return { status: 'error', message: 'Graph completed with unexpected status.' };
  }
}
