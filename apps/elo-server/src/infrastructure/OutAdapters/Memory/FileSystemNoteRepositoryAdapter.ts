import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';
import { NoteRepositoryPort } from '../../../domain/ports/NoteRepositoryPort';
import { Note } from '../../../domain/Entities/Note';
import { LoggerPort } from '../../../domain/ports/LoggerPort';

export class FileSystemNoteRepositoryAdapter implements NoteRepositoryPort {
  constructor(
    private readonly memoryPath: string,
    private readonly logger: LoggerPort
  ) {
    if (!fs.existsSync(memoryPath)) {
      throw new Error(`Memory path does not exist: ${memoryPath}`);
    }
  }

  public async getNoteById(id: string): Promise<Note | null> {
    const fullPath = path.join(this.memoryPath, id);
    if (!fs.existsSync(fullPath)) return null;

    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      return this.parseNote(id, raw, fullPath);
    } catch (e) {
      this.logger.error(`Error reading note ${id}: ${e}`);
      return null;
    }
  }

  public async saveNote(note: Note): Promise<void> {
    const fullPath = path.join(this.memoryPath, note.id);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, note.content, 'utf-8');
  }

  public async renameNote(oldId: string, newId: string): Promise<void> {
    const oldPath = path.join(this.memoryPath, oldId);
    const newPath = path.join(this.memoryPath, newId);
    if (!fs.existsSync(oldPath)) {
      throw new Error(`Note not found: ${oldId}`);
    }
    const newDir = path.dirname(newPath);
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }
    fs.renameSync(oldPath, newPath);
  }

  public async deleteNote(id: string): Promise<void> {
    const fullPath = path.join(this.memoryPath, id);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  public async searchNotesByTag(tag: string): Promise<Note[]> {
    const allNotes = await this.getAllNotes();
    const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
    return allNotes.filter(note => note.isTaggedWith(normalizedTag) || note.isTaggedWith(`#${normalizedTag}`));
  }

  public async getAllNotes(): Promise<Note[]> {
    const files = this.listMarkdownFiles(this.memoryPath);
    const notes: Note[] = [];

    for (const filePath of files) {
      const relativePath = path.relative(this.memoryPath, filePath);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const note = this.parseNote(relativePath, raw, filePath);
        notes.push(note);
      } catch (e) {
        this.logger.error(`Error reading ${relativePath}: ${e}`);
      }
    }

    return notes;
  }

  public async getNotesModifiedSince(since: Date): Promise<Note[]> {
    const sinceMs = since.getTime();
    const files = this.listMarkdownFiles(this.memoryPath);
    const notes: Note[] = [];

    for (const filePath of files) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs > sinceMs) {
          const relativePath = path.relative(this.memoryPath, filePath);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const note = this.parseNote(relativePath, raw, filePath);
          notes.push(note);
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }

    return notes;
  }

  private parseNote(relativePath: string, raw: string, fullPath: string): Note {
    const stat = fs.statSync(fullPath);
    let frontmatter: Record<string, unknown> = {};
    let content = raw;
    let tags: string[] = [];

    try {
      // Try to parse with gray-matter
      const parsed = matter(raw);
      frontmatter = parsed.data;
      content = parsed.content;

      // Tags from frontmatter
      if (Array.isArray(frontmatter.tags)) {
        tags.push(...frontmatter.tags.map((t: string) => String(t)));
      } else if (typeof frontmatter.tags === 'string') {
        tags.push(frontmatter.tags);
      }
    } catch (e: any) {
      // Fallback for messy YAML (duplicate keys, unclosed quotes, etc)
      this.logger.warn(`⚠️ Warning: Could not parse YAML frontmatter in ${relativePath}: ${e.message.split('\n')[0]}`);
      
      // We still want to index the file, so we strip frontmatter manually using regex as a best-effort fallback
      const match = raw.match(/---[\s\S]*?---\n([\s\S]*)/);
      if (match) {
        content = match[1];
      }
    }

    // Inline #tags from content
    const inlineTags = content.match(/#[\w\-/]+/g);
    if (inlineTags) {
      tags.push(...inlineTags.filter(t => !tags.includes(t.slice(1))));
    }

    return new Note(
      relativePath,
      path.basename(relativePath, '.md'),
      raw, // Keep full content including frontmatter for RAG context
      [...new Set(tags)],
      new Date(stat.birthtimeMs),
      new Date(stat.mtimeMs),
      frontmatter
    );
  }

  private listMarkdownFiles(dir: string): string[] {
    const results: string[] = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip hidden dirs/files (like .obsidian, .trash)
      if (entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        results.push(...this.listMarkdownFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  }
}
