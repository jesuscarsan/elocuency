import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplyTemplateUseCase, ApplyTemplateRequest } from './ApplyTemplateUseCase';
import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { TemplateCachePort, TemplateInfo } from '../../domain/ports/TemplateCachePort';
import { LLMServicePort } from '../../domain/ports/LLMServicePort';
import { ImageSearchPort } from '../../domain/ports/ImageSearchPort';
import { PersonasNoteOrganizer } from '../services/PersonasNoteOrganizer';
import { Note } from '../../domain/Entities/Note';
import * as path from 'path';

describe('ApplyTemplateUseCase Data Preservation', () => {
  let noteRepository: NoteRepositoryPort;
  let templateCache: TemplateCachePort;
  let llmService: LLMServicePort;
  let imageSearch: ImageSearchPort;
  let personasOrganizer: PersonasNoteOrganizer;
  let useCase: ApplyTemplateUseCase;

  beforeEach(() => {
    noteRepository = {
      getNoteById: vi.fn(),
      saveNote: vi.fn(),
      getAllNotes: vi.fn(),
      renameNote: vi.fn(),
    } as any;

    templateCache = {
      getCachedTemplates: vi.fn(),
    } as any;

    llmService = {
      ask: vi.fn(),
    } as any;

    imageSearch = {
      searchImages: vi.fn(),
    } as any;

    personasOrganizer = {
      organize: vi.fn().mockImplementation((path) => Promise.resolve(path)),
    } as any;

    const logger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any;

    useCase = new ApplyTemplateUseCase(
      noteRepository,
      templateCache,
      llmService,
      imageSearch,
      personasOrganizer,
      logger
    );
  });

  it('should preserve existing frontmatter and merge tags', async () => {
    // Arrange
    const targetNote = new Note(
      'notes/my-note.md',
      'My Note',
      '---\nCategory: Personal\ntags: [old-tag]\n---\nExisting body content',
      ['old-tag'],
      new Date(),
      new Date(),
      {}
    );

    const templateContent = '---\ntags: [new-tag]\nCategory: TemplateCat\nNewField: Value\n---\nTemplate Boilerplate';
    const templateNote = new Note(
      '!!metadata/templates/Persona.md',
      'Persona',
      templateContent,
      [],
      new Date(),
      new Date(),
      {}
    );

    vi.mocked(noteRepository.getNoteById).mockImplementation((id) => {
      if (id === 'notes/my-note.md') return Promise.resolve(targetNote);
      if (id === '!!metadata/templates/Persona.md') return Promise.resolve(templateNote);
      return Promise.resolve(null);
    });

    vi.mocked(templateCache.getCachedTemplates).mockResolvedValue([
      { template: 'Persona.md', description: 'Test' } as TemplateInfo
    ]);

    const request: ApplyTemplateRequest = {
      targetNotePath: 'notes/my-note.md',
      templateId: 'Persona.md'
    };

    // Act
    await useCase.execute(request);

    // Assert
    const savedNote = vi.mocked(noteRepository.saveNote).mock.calls[0][0] as Note;
    expect(savedNote.content).toContain('Category: Personal'); // Preserved
    expect(savedNote.content).toContain('NewField: Value'); // Added
    expect(savedNote.content).toContain('Template Boilerplate'); // Prepended
    expect(savedNote.content).toContain('Existing body content'); // Appended
    
    // Check tags (merged)
    expect(savedNote.content).toContain('old-tag');
    expect(savedNote.content).toContain('new-tag');
  });

  it('should preserve existing frontmatter during LLM enrichment', async () => {
    // Arrange
    const targetNoteBody = '---\nCategory: Personal\n---\nOriginal body';
    const targetNote = new Note(
      'notes/my-note.md',
      'My Note',
      targetNoteBody,
      [],
      new Date(),
      new Date(),
      {}
    );

    const templateContent = '---\n"!!commands": [ApplyPromptCommand]\n"!!prompt": "enrich this"\n---\nTemplate structure';
    const templateNote = new Note(
      '!!metadata/templates/Persona.md',
      'Persona',
      templateContent,
      [],
      new Date(),
      new Date(),
      {}
    );

    vi.mocked(noteRepository.getNoteById).mockImplementation((id) => {
      if (id === 'notes/my-note.md') {
          // Second call in executePromptLogic returns the note after initial merge
          if (vi.mocked(noteRepository.saveNote).mock.calls.length > 0) {
              const firstSave = vi.mocked(noteRepository.saveNote).mock.calls[0][0] as Note;
              return Promise.resolve(firstSave);
          }
          return Promise.resolve(targetNote);
      }
      if (id === '!!metadata/templates/Persona.md') return Promise.resolve(templateNote);
      return Promise.resolve(null);
    });

    vi.mocked(templateCache.getCachedTemplates).mockResolvedValue([
      { template: 'Persona.md', description: 'Test' } as TemplateInfo
    ]);

    vi.mocked(llmService.ask).mockResolvedValue({
      content: JSON.stringify({
        frontmatter: { Category: 'LLM-Overwritten', NewField: 'LLM-Value' },
        body: 'LLM Body Content'
      }),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    });

    const request: ApplyTemplateRequest = {
      targetNotePath: 'notes/my-note.md',
      templateId: 'Persona.md'
    };

    // Act
    await useCase.execute(request);

    // Assert
    const lastSave = vi.mocked(noteRepository.saveNote).mock.calls[1][0] as Note;
    expect(lastSave.content).toContain('Category: Personal'); // PRESERVED, not replaced by LLM
    expect(lastSave.content).toContain('NewField: LLM-Value'); // Added
    expect(lastSave.content).toContain('LLM Body Content'); // Prepended
    expect(lastSave.content).toContain('Original body'); // PRESERVED
    expect(lastSave.content).toContain('Template structure'); // PRESERVED (from initial merge)
  });

  it('should not modify body if LLM returns empty body', async () => {
    // Arrange
    const targetNote = new Note(
      'notes/my-note.md',
      'My Note',
      'Original body',
      [],
      new Date(),
      new Date(),
      {}
    );

    const templateContent = '---\n"!!commands": [ApplyPromptCommand]\n"!!prompt": "enrich"\n---\n';
    const templateNote = new Note(
      '!!metadata/templates/Persona.md',
      'Persona',
      templateContent,
      [],
      new Date(),
      new Date(),
      {}
    );

    vi.mocked(noteRepository.getNoteById).mockImplementation((id) => {
      if (id === 'notes/my-note.md') return Promise.resolve(targetNote);
      if (id === '!!metadata/templates/Persona.md') return Promise.resolve(templateNote);
      return Promise.resolve(null);
    });

    vi.mocked(templateCache.getCachedTemplates).mockResolvedValue([
      { template: 'Persona.md', description: 'Test' } as TemplateInfo
    ]);

    vi.mocked(llmService.ask).mockResolvedValue({
      content: JSON.stringify({
        frontmatter: { NewField: 'LLM-Value' },
        body: ''
      }),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    });

    // Act
    await useCase.execute({ targetNotePath: 'notes/my-note.md', templateId: 'Persona.md' });

    // Assert
    const lastSave = vi.mocked(noteRepository.saveNote).mock.calls[1][0] as Note;
    expect(lastSave.content).toBe('---\nNewField: LLM-Value\n---\n\nOriginal body');
  });
});
