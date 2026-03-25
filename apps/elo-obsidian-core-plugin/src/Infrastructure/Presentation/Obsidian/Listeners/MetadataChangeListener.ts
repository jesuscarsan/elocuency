import { App, TFile, Command, MarkdownView } from 'obsidian';
import { FrontmatterRegistry } from '../Constants/FrontmatterRegistry';

export class MetadataChangeListener {
	private app: App;
	private previousFrontmatter: Record<string, any> = {};

	constructor(app: App) {
		this.app = app;
		this.registerEvents();
	}

	private registerEvents() {
		this.app.metadataCache.on('changed', async (file: TFile) => {
			await this.handleMetadataChange(file);
		});
	}

	private async handleMetadataChange(file: TFile) {
		// console.log(`[FrontmatterEventService] START Metadata changed for ${file.path}`);
		if (!file || file.extension !== 'md') return;

		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache || !cache.frontmatter) return;

		const currentFrontmatter = cache.frontmatter;
		const filePath = file.path;

		// Initialize cache for this file if it doesn't exist
		if (!this.previousFrontmatter[filePath]) {
			this.previousFrontmatter[filePath] = { ...currentFrontmatter };
			return;
		}

		const previous = this.previousFrontmatter[filePath];

		// Check for changes in registered fields
		for (const key of Object.keys(FrontmatterRegistry)) {
			const fieldConfig = FrontmatterRegistry[key];
			if (!fieldConfig.commands || fieldConfig.commands.length === 0) continue;

			const currentValue = currentFrontmatter[fieldConfig.key];
			const previousValue = previous[fieldConfig.key];

			// proper deep comparison or simple strict equality depending on needs
			// treating arrays simply for now
			if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
				// console.log(`[FrontmatterEventService] Field '${fieldConfig.key}' changed in ${file.basename}. Executing commands:`, fieldConfig.commands);

				for (const commandId of fieldConfig.commands) {
					await this.executeCommand(commandId);
				}
			}
		}

		// Update cache
		this.previousFrontmatter[filePath] = { ...currentFrontmatter };
	}

	private async executeCommand(commandId: string) {
		// Decouple command execution from the synchronous metadata change event
		// to avoid race conditions with Obsidian's internal suggestion UI handling.
		// A small delay (50ms) is enough for the UI event to finish.
		window.setTimeout(async () => {
			await this.processExecuteCommand(commandId);
		}, 50);
	}

	private async processExecuteCommand(commandId: string) {
		// Resolve command ID
		let command = this.findObsidianCommand(commandId);

		// If not found and no prefix, try with 'elocuency:' prefix
		if (!command && !commandId.includes(':')) {
			command = this.findObsidianCommand(`elocuency:${commandId}`);
		}

		// If still not found and HAS prefix, try without prefix just in case it was registered differently
		if (!command && commandId.startsWith('elocuency:')) {
			const subId = commandId.split(':')[1];
			command = this.findObsidianCommand(subId);
		}

		if (command) {
			try {
				if (command.callback) {
					await command.callback();
				} else if (command.editorCallback) {
					const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (activeView) {
						await command.editorCallback(activeView.editor, activeView);
					}
				} else if (command.checkCallback) {
					await command.checkCallback(false);
				} else {
					// @ts-ignore
					this.app.commands.executeCommandById(command.id);
				}
			} catch (e) {
				console.error(`[FrontmatterEventService] Error executing command ${command.id}:`, e);
			}
		} else {
			console.warn(`[FrontmatterEventService] Command '${commandId}' not found in Obsidian Registry.`);
		}
	}

	private findObsidianCommand(id: string): Command | undefined {
		// @ts-ignore
		return this.app.commands.findCommand(id);
	}
}
