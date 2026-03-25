import { Note } from '../Entities/Note';

export interface NoteRepositoryPort {
  getNoteById(id: string): Promise<Note | null>;
  saveNote(note: Note): Promise<void>;
  renameNote(oldId: string, newId: string): Promise<void>;
  deleteNote(id: string): Promise<void>;
  searchNotesByTag(tag: string): Promise<Note[]>;
  getAllNotes(): Promise<Note[]>;
  getNotesModifiedSince(since: Date): Promise<Note[]>;
}
