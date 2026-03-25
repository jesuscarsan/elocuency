import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { VectorDbPort, VectorDocument } from '../../domain/ports/VectorDbPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export class SyncVaultUseCase {
  private lastSyncDate: Date | null = null;
  private readonly cooldownMs: number;
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(
    private readonly noteRepository: NoteRepositoryPort,
    private readonly vectorDb: VectorDbPort,
    private readonly logger: LoggerPort,
    options?: { cooldownMinutes?: number; chunkSize?: number; chunkOverlap?: number }
  ) {
    this.cooldownMs = (options?.cooldownMinutes ?? 5) * 60 * 1000;
    this.chunkSize = options?.chunkSize ?? 1000;
    this.chunkOverlap = options?.chunkOverlap ?? 200;
  }

  /**
   * Executes an on-demand incremental sync.
   * Returns the number of chunks synced, or -1 if skipped due to cooldown.
   */
  public async execute(force = false): Promise<number> {
    // 1. Check cooldown
    if (!force && this.lastSyncDate) {
      const elapsed = Date.now() - this.lastSyncDate.getTime();
      if (elapsed < this.cooldownMs) {
        return -1; // Skipped
      }
    }

    // 2. Fetch modified notes
    const notes = this.lastSyncDate
      ? await this.noteRepository.getNotesModifiedSince(this.lastSyncDate)
      : await this.noteRepository.getAllNotes();

    if (notes.length === 0) {
      this.lastSyncDate = new Date();
      return 0;
    }

    // 3. Split into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });

    const documents: VectorDocument[] = [];

    for (const note of notes) {
      if (!note.content) continue;

      const chunks = await splitter.createDocuments(
        [note.content],
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
      await this.vectorDb.addDocuments(documents);
    }

    this.lastSyncDate = new Date();
    return documents.length;
  }
}
