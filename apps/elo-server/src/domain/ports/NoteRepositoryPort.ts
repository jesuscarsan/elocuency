import { Note } from '../Entities/Note';

export interface NoteRepositoryPort {
  getNoteById(id: string): Promise<Note | null>;
  saveNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;
  searchNotesByTag(tag: string): Promise<Note[]>;
  getAllNotes(): Promise<Note[]>;
}
