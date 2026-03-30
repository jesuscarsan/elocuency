import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateNoteAIUseCase } from './GenerateNoteAIUseCase';
import { TemplateCachePort } from '../../domain/ports/TemplateCachePort';
import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { VectorDbPort } from '../../domain/ports/VectorDbPort';
import { TaskQueuePort } from '../../domain/ports/TaskQueuePort';
import { ApplyTemplateAIUseCase } from './ApplyTemplateAIUseCase';
import { Note } from '../../domain/Entities/Note';

describe('GenerateNoteAIUseCase', () => {
  let templateCache: TemplateCachePort;
  let noteRepository: NoteRepositoryPort;
  let vectorDb: VectorDbPort;
  let taskQueue: TaskQueuePort;
  let applyTemplateAI: ApplyTemplateAIUseCase;
  let logger: LoggerPort;
  let baseLLM: any;
  let useCase: GenerateNoteAIUseCase;

  beforeEach(() => {
    templateCache = {} as any;
    noteRepository = { saveNote: vi.fn() } as any;
    vectorDb = {} as any;
    taskQueue = {} as any;
    applyTemplateAI = {} as any;

    logger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as LoggerPort;

    baseLLM = {
      withStructuredOutput: vi.fn().mockImplementation(() => {
        return {
          invoke: vi.fn().mockResolvedValue({ entry: "Hoy tuve una reunión." })
        };
      }),
    } as any;

    useCase = new GenerateNoteAIUseCase(templateCache, noteRepository, vectorDb, taskQueue, applyTemplateAI, logger, baseLLM);

    // Mock diary logic internally
    useCase['getDiaryPath'] = vi.fn().mockReturnValue('/mock/diary');
    useCase['appendToDiaryNote'] = vi.fn().mockResolvedValue(undefined);
  });

  it('should process the prompt and return success', async () => {
    const result = await useCase.execute('Tuve una reunión', 'test-user');

    expect(result.status).toBe('success');
    expect(result.notes).toBeDefined();
    expect(result.notes![0].title).toContain('Log-');
    expect(noteRepository.saveNote).toHaveBeenCalled();
  });
});
