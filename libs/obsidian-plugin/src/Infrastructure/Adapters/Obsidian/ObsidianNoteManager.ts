import { App, TFile, normalizePath } from 'obsidian';
import { NoteManagerPort, NoteItem, NoteMetadata } from '../../../../../core-typescript/dist';
import { ObsidianMetadataAdapter } from './ObsidianMetadataAdapter';
import { HeaderMetadata } from '../../../../../core-typescript/dist';

export class ObsidianNoteManager implements NoteManagerPort {
	constructor(private app: App) { }

	getActiveNote(): NoteItem | null {
		const file = this.app.workspace.getActiveFile();
		if (!file) return null;
		return this.mapToNoteItem(file);
	}

	async getActiveNoteContent(): Promise<string | null> {
		const file = this.app.workspace.getActiveFile();
		if (!file) return '';
		return await this.app.vault.read(file);
	}

	async readNote(path: string): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return await this.app.vault.read(file);
		}
		return '';
	}

	async getNoteMetadata(path: string): Promise<NoteMetadata> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			const metaService = new ObsidianMetadataAdapter(this.app);
			return await metaService.getFileMetadata(file);
		}
		return {};
	}

	async renameFile(fileItem: NoteItem | string, newPath: string): Promise<void> {
		const path = typeof fileItem === 'string' ? fileItem : fileItem.path;
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			await this.app.fileManager.renameFile(file, newPath);
		}
	}

	async ensureFolderExists(path: string): Promise<void> {
		const folders = path.split('/').filter((f) => f.length > 0);
		if (folders.length === 0) return;

		let currentPath = '';
		for (const folder of folders) {
			currentPath = currentPath === '' ? folder : `${currentPath}/${folder}`;
			const normalized = normalizePath(currentPath);
			const exists = this.app.vault.getAbstractFileByPath(normalized);
			if (!exists) {
				await this.app.vault.createFolder(normalized);
			}
		}
	}

	normalizePath(path: string): string {
		return normalizePath(path);
	}

	async getNoteHeadings(path: string): Promise<any[]> {
		// using any[] or specific type mapping
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			const cache = this.app.metadataCache.getFileCache(file);
			return cache?.headings || [];
		}
		return [];
	}

	async updateBlockMetadata(
		path: string,
		blockId: string,
		metadata: HeaderMetadata,
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			const metaService = new ObsidianMetadataAdapter(this.app);
			await metaService.updateBlockMetadata(file, blockId, metadata);
		}
	}

	private mapToNoteItem(file: TFile): NoteItem {
		return {
			path: file.path,
			name: file.name,
			extension: file.extension,
			basename: file.basename,
		};
	}
}
