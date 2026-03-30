import { App, TFile, MarkdownView, requestUrl, debounce } from 'obsidian';
import { UnresolvedLinkGeneratorSettings } from '../settings';

export class NoteChangeListener {
	private app: App;
	private settings: UnresolvedLinkGeneratorSettings;
	private dirtyFiles: Set<string> = new Set();
	private debouncedSync: (file: TFile) => void;

	constructor(app: App, settings: UnresolvedLinkGeneratorSettings) {
		this.app = app;
		this.settings = settings;

		// 30 seconds debounce as requested
		this.debouncedSync = debounce(async (file: TFile) => {
			if (this.dirtyFiles.has(file.path)) {
				await this.syncNote(file.path);
			}
		}, 30000, true);

		this.registerEvents();
	}

	private registerEvents() {
		// 1. Listen for modifications
		this.app.vault.on('modify', (file) => {
			if (file instanceof TFile && file.extension === 'md') {
				this.dirtyFiles.add(file.path);
				this.debouncedSync(file);
			}
		});

		// 2. Listen for note switches (Active Leaf Change)
		this.app.workspace.on('active-leaf-change', async (leaf) => {
			// When switching away from a note, if it was dirty, sync it immediately
			const filesToSync = Array.from(this.dirtyFiles);
			for (const path of filesToSync) {
				// If the file is no longer the active one, sync it now
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || activeFile.path !== path) {
					await this.syncNote(path);
				}
			}
		});
	}

	private async syncNote(path: string) {
		if (!this.dirtyFiles.has(path)) return;

		const serverUrl = this.settings.eloServerUrl || 'http://localhost:8001';
		const serverToken = this.settings.eloServerToken || '';
		const url = `${serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl}/api/memory/sync-note`;

		try {
			console.log(`[NoteChangeListener] Syncing note to RAG: ${path}`);
			const response = await requestUrl({
				url,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${serverToken}`,
				},
				body: JSON.stringify({ path }),
			});

			if (response.status === 202) {
				this.dirtyFiles.delete(path);
				console.log(`[NoteChangeListener] Note sync accepted by server: ${path}`);
			} else {
				console.warn(`[NoteChangeListener] Failed to sync note ${path}: Server returned ${response.status}`);
			}
		} catch (e) {
			console.error(`[NoteChangeListener] Error syncing note ${path}:`, e);
		}
	}
}
