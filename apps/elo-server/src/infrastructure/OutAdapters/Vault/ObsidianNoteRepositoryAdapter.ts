import { NoteRepositoryPort } from '../../../domain/ports/NoteRepositoryPort';
import { Note } from '../../../domain/Entities/Note';

export interface ObsidianConfig {
  url: string;
  apiKey: string;
}

export class ObsidianNoteRepositoryAdapter implements NoteRepositoryPort {
  constructor(private readonly config: ObsidianConfig) {}

  public async getNoteById(id: string): Promise<Note | null> {
    try {
      const resp = await fetch(`${this.config.url}/vault/${encodeURIComponent(id)}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'application/vnd.olrapi.note+json'
        }
      });
      if (!resp.ok) {
        if (resp.status === 404) return null;
        throw new Error(`Failed to fetch note: ${resp.status}`);
      }
      const data = await resp.json();
      return new Note(
        id,
        id.split('/').pop()?.replace('.md', '') || id,
        data.content || '',
        data.tags || [],
        new Date(data.stat?.ctime || Date.now()),
        new Date(data.stat?.mtime || Date.now()),
        data.frontmatter || {}
      );
    } catch (e) {
      console.error(`Error fetching note ${id}:`, e);
      return null;
    }
  }

  public async saveNote(note: Note): Promise<void> {
    try {
      const resp = await fetch(`${this.config.url}/vault/${encodeURIComponent(note.id)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'text/markdown'
        },
        body: note.content
      });
      if (!resp.ok) {
        throw new Error(`Failed to save note: ${resp.status}`);
      }
    } catch (e) {
      console.error(`Error saving note ${note.id}:`, e);
      throw e;
    }
  }

  public async deleteNote(id: string): Promise<void> {
    try {
      const resp = await fetch(`${this.config.url}/vault/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      if (!resp.ok && resp.status !== 404) {
        throw new Error(`Failed to delete note: ${resp.status}`);
      }
    } catch (e) {
      console.error(`Error deleting note ${id}:`, e);
      throw e;
    }
  }

  public async searchNotesByTag(tag: string): Promise<Note[]> {
    try {
      // Use Dataview DQL through Obsidian API
      const dql = `TABLE file.mtime, file.tags WHERE contains(file.tags, "${tag}")`;
      const resp = await fetch(`${this.config.url}/search/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/vnd.olrapi.dataview.dql+txt'
        },
        body: dql
      });
      if (!resp.ok) {
        throw new Error(`Search failed: ${resp.status}`);
      }
      const changes = await resp.json();
      
      const notes: Note[] = [];
      for (const item of changes) {
        const path = item.filename;
        if (path) {
          const note = await this.getNoteById(path);
          if (note) notes.push(note);
        }
      }
      return notes;
    } catch (e) {
      console.error(`Error searching notes by tag ${tag}:`, e);
      return [];
    }
  }

  public async getAllNotes(): Promise<Note[]> {
    try {
      const resp = await fetch(`${this.config.url}/search/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/vnd.olrapi.dataview.dql+txt'
        },
        body: 'TABLE file.mtime WHERE file.name != ""'
      });
      if (!resp.ok) throw new Error(`Get all failed: ${resp.status}`);
      
      const changes = await resp.json();
      const notes: Note[] = [];
      for (const item of changes) {
        if (item.filename) {
          const note = await this.getNoteById(item.filename);
          if (note) notes.push(note);
        }
      }
      return notes;
    } catch (e) {
      console.error('Error getting all notes:', e);
      return [];
    }
  }

  public async getNotesModifiedSince(since: Date): Promise<Note[]> {
    try {
      const isoDate = since.toISOString().replace('Z', '').split('.')[0];
      const dql = `TABLE file.mtime WHERE file.mtime > date("${isoDate}")`;

      const resp = await fetch(`${this.config.url}/search/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/vnd.olrapi.dataview.dql+txt'
        },
        body: dql
      });
      if (!resp.ok) throw new Error(`Get modified notes failed: ${resp.status}`);

      const changes = await resp.json();
      const notes: Note[] = [];
      for (const item of changes) {
        if (item.filename) {
          const note = await this.getNoteById(item.filename);
          if (note) notes.push(note);
        }
      }
      return notes;
    } catch (e) {
      console.error('Error getting modified notes:', e);
      return [];
    }
  }
}

