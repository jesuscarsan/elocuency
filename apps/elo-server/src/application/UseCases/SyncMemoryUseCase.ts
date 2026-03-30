import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { Note } from '../../domain/Entities/Note';
import { VectorDbPort, VectorDocument } from '../../domain/ports/VectorDbPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MarkdownCleaner } from '../services/MarkdownCleaner';

export class SyncMemoryUseCase {
  private lastSyncDate: Date | null = null;
  private readonly cooldownMs: number;
  private readonly worldPath: string;
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(
    private readonly noteRepository: NoteRepositoryPort,
    private readonly vectorDb: VectorDbPort,
    private readonly logger: LoggerPort,
    options?: { cooldownMinutes?: number; chunkSize?: number; chunkOverlap?: number; worldPath?: string }
  ) {
    this.cooldownMs = (options?.cooldownMinutes ?? 5) * 60 * 1000;
    this.chunkSize = options?.chunkSize ?? 1000;
    this.chunkOverlap = options?.chunkOverlap ?? 200;
    this.worldPath = options?.worldPath ?? '';
  }

  /**
   * Executes an on-demand incremental sync.
   * If notePath is provided, only that note is synced.
   * Returns the number of chunks synced, or -1 if skipped due to cooldown.
   */
  public async execute(force = false, notePath?: string): Promise<number> {
    // 1. Check cooldown (global sync only)
    if (!notePath && !force && this.lastSyncDate) {
      const elapsed = Date.now() - this.lastSyncDate.getTime();
      if (elapsed < this.cooldownMs) {
        return -1; // Skipped
      }
    }

    // 2. Fetch notes to sync
    let notes: Note[] = [];
    if (notePath) {
      const note = await this.noteRepository.getNoteById(notePath);
      if (note) notes = [note];
    } else {
      notes = this.lastSyncDate
        ? await this.noteRepository.getNotesModifiedSince(this.lastSyncDate)
        : await this.noteRepository.getAllNotes();
    }

    if (notes.length === 0) {
      this.lastSyncDate = new Date();
      return 0;
    }

    // 3. Clean and Split into chunks
    const cleaner = new MarkdownCleaner();
    const { MarkdownTextSplitter } = await import('@langchain/textsplitters');
    const splitter = new MarkdownTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });

    const documents: VectorDocument[] = [];

    for (const note of notes) {
      if (!note.content) continue;

      const cleanContent = cleaner.clean(note.content, { 
        path: note.id, // Still pass it for frontmatter cleanup if needed, but it won't be injected into text
        title: note.title,
        worldPath: this.worldPath 
      });

      // Context Injection: Prepend Title to every chunk
      const contentWithContext = `Title: ${note.title}\n\n${cleanContent}`;

      const chunks = await splitter.createDocuments(
        [contentWithContext],
        [{ path: note.id, source: note.id, title: note.title, tags: note.tags }]
      );

      for (const chunk of chunks) {
        documents.push({
          id: `${note.id}::${documents.length}`,
          content: chunk.pageContent,
          metadata: chunk.metadata as Record<string, unknown>,
        });
      }
    }

    // 4. Upsert into vector DB
    if (documents.length > 0) {
      // If we are syncing a single note, ensure old chunks are removed first
      if (notePath) {
        await this.vectorDb.deleteNoteDocuments(notePath);
      }
      await this.vectorDb.addDocuments(documents);
    }

    if (!notePath) {
      this.lastSyncDate = new Date();
    }
    return documents.length;
  }
}
