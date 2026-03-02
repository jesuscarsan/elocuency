import { Note } from '../Models/Note';

export interface NoteRepositoryPort {
    getNote(path: string): Promise<Note | null>;
    saveNote(note: Note): Promise<void>;
    createNote(path: string, content: string): Promise<void>;
    deleteNote(path: string): Promise<void>;
    renameNote(oldPath: string, newPath: string): Promise<void>;
    getAllNotes(): Promise<Note[]>;
    resolvePath(path: string): string | null;
}
