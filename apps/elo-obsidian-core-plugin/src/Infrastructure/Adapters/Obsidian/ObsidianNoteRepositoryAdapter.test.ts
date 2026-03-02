import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianNoteRepositoryAdapter } from './ObsidianNoteRepositoryAdapter';
import { TFile } from 'obsidian';

describe('ObsidianNoteRepositoryAdapter', () => {
	let adapter: ObsidianNoteRepositoryAdapter;
	let mockApp: any;

	beforeEach(() => {
		mockApp = {
			vault: {
				getAbstractFileByPath: vi.fn(),
				modify: vi.fn(),
				create: vi.fn(),
				getMarkdownFiles: vi.fn(),
				read: vi.fn(),
				delete: vi.fn(),
			},
			metadataCache: {
				getFileCache: vi.fn(),
				getFirstLinkpathDest: vi.fn(),
			},
			fileManager: {
				renameFile: vi.fn(),
			},
		};
		adapter = new ObsidianNoteRepositoryAdapter(mockApp);
	});

	it('should check if note exists', async () => {
		mockApp.vault.getAbstractFileByPath.mockReturnValue(new (TFile as any)('test.md'));
		const result = await adapter.exists('test.md');
		expect(result).toBe(true);
	});

	it('should return null if path is a folder', async () => {
		mockApp.vault.getAbstractFileByPath.mockReturnValue({} as any); // Not an instance of TFile
		const note = await adapter.getNote('folder');
		expect(note).toBeNull();
	});

	it('should return false if note does not exist', async () => {
		mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
		const result = await adapter.exists('test.md');
		expect(result).toBe(false);
	});

	it('should save note by modifying existing file', async () => {
		const mockFile = new (TFile as any)('test.md');
		mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
		const note = { path: 'test.md', content: 'New Content' } as any;

		await adapter.saveNote(note);
		expect(mockApp.vault.modify).toHaveBeenCalledWith(mockFile, 'New Content');
	});

	it('should create a new note if it does not exist', async () => {
		const note = { path: 'new.md', content: 'New Content' } as any;
		mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
		await adapter.saveNote(note);
		expect(mockApp.vault.create).toHaveBeenCalledWith('new.md', 'New Content');
	});

	it('should update existing file in createNote if it already exists', async () => {
		const mockFile = new (TFile as any)('existing.md');
		mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
		await adapter.createNote('existing.md', 'New Content');
		expect(mockApp.vault.modify).toHaveBeenCalledWith(mockFile, 'New Content');
	});

	it('should get note with frontmatter and body', async () => {
		const mockFile = new (TFile as any)('test.md');
		mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
		mockApp.vault.read.mockResolvedValue('---\nkey: value\n---\nbody');
		mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter: { key: 'value' } });

		const note = await adapter.getNote('test.md');
		expect(note?.frontmatter).toEqual({ key: 'value' });
		expect(note?.body).toBe('body');
	});

	it('should delete note', async () => {
		const mockFile = new (TFile as any)('test.md');
		mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
		await adapter.deleteNote('test.md');
		expect(mockApp.vault.delete).toHaveBeenCalledWith(mockFile);
	});

	it('should do nothing if file to delete does not exist', async () => {
		mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
		await adapter.deleteNote('test.md');
		expect(mockApp.vault.delete).not.toHaveBeenCalled();
	});

	it('should rename note', async () => {
		const mockFile = new (TFile as any)('old.md');
		mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
		await adapter.renameNote('old.md', 'new.md');
		expect(mockApp.fileManager.renameFile).toHaveBeenCalledWith(mockFile, 'new.md');
	});

	it('should resolve path using metadataCache', () => {
		const mockFile = new (TFile as any)('resolved.md');
		mockApp.metadataCache.getFirstLinkpathDest.mockReturnValue(mockFile);
		const path = adapter.resolvePath('link');
		expect(path).toBe('resolved.md');
	});

	it('should get all notes (currently returns empty array)', async () => {
		mockApp.vault.getMarkdownFiles.mockReturnValue([new (TFile as any)('1.md')]);
		const notes = await adapter.getAllNotes();
		expect(notes).toEqual([]);
	});
});
