import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncMemoryUseCase } from './SyncMemoryUseCase';
import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { VectorDbPort, VectorDocument } from '../../domain/ports/VectorDbPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { Note } from '../../domain/Entities/Note';

describe('SyncMemoryUseCase', () => {
  let noteRepository: NoteRepositoryPort;
  let vectorDb: VectorDbPort;
  let logger: LoggerPort;
  let useCase: SyncMemoryUseCase;

  beforeEach(() => {
    noteRepository = {
      getAllNotes: vi.fn(),
      getNotesModifiedSince: vi.fn(),
      getNoteById: vi.fn(),
      saveNote: vi.fn(),
      renameNote: vi.fn(),
      deleteNote: vi.fn(),
      searchNotesByTag: vi.fn(),
    };

    vectorDb = {
      init: vi.fn(),
      addDocuments: vi.fn(),
      search: vi.fn(),
      deleteDocument: vi.fn(),
      close: vi.fn(),
    };

    logger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    useCase = new SyncMemoryUseCase(noteRepository, vectorDb, logger, { cooldownMinutes: 0 });
  });

  it('should prepend the note title and path to the content during indexing', async () => {
    // Arrange
    const note = new Note(
      'Mi mundo/Fernando (Pili).md',
      'Fernando (Pili)',
      '---\ntags: [Personas/Familia]\n---\nHello world',
      ['Personas/Familia'],
      new Date(),
      new Date(),
      {}
    );

    vi.mocked(noteRepository.getAllNotes).mockResolvedValue([note]);

    // Act
    await useCase.execute(true);

    // Assert
    expect(vectorDb.addDocuments).toHaveBeenCalled();
    const addedDocs = vi.mocked(vectorDb.addDocuments).mock.calls[0][0] as VectorDocument[];
    
    // Check that at least one chunk contains Path and Title
    const content = addedDocs[0].content;
    expect(content).toContain('Path: Mi mundo/Fernando (Pili).md');
    expect(content).toContain('Title: Fernando (Pili)');
    expect(content).toContain('Hello world');
  });

  it('should strip path prefix when provided', async () => {
    // Arrange
    const customUseCase = new SyncMemoryUseCase(noteRepository, vectorDb, logger, { 
      cooldownMinutes: 0,
      worldPath: 'Mi mundo/'
    });
    
    const note = new Note(
      'Mi mundo/Europa/España.md',
      'España',
      'Contenido de España',
      ['Lugar'],
      new Date(),
      new Date(),
      {}
    );

    vi.mocked(noteRepository.getAllNotes).mockResolvedValue([note]);

    // Act
    await customUseCase.execute(true);

    // Assert
    const addedDocs = vi.mocked(vectorDb.addDocuments).mock.calls[0][0] as VectorDocument[];
    expect(addedDocs[0].content).toContain('Path: Europa/España.md');
    expect(addedDocs[0].content).not.toContain('Path: Mi mundo/Europa/España.md');
  });

  it('should index notes with empty body content using title and path', async () => {
    // Arrange
    const sparseNote = new Note(
      'Mi mundo/Empty Note.md',
      'Empty Note',
      '---\ntags: [empty]\n---',
      ['empty'],
      new Date(),
      new Date(),
      {}
    );

    vi.mocked(noteRepository.getAllNotes).mockResolvedValue([sparseNote]);

    // Act
    await useCase.execute(true);

    // Assert
    const addedDocs = vi.mocked(vectorDb.addDocuments).mock.calls[0][0] as VectorDocument[];
    expect(addedDocs[0].content).toContain('Path: Mi mundo/Empty Note.md');
    expect(addedDocs[0].content).toContain('Title: Empty Note');
    expect(addedDocs[0].content).toContain('tags: [empty]');
  });
});
