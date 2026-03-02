import { App, TFile, Command, MarkdownView } from 'obsidian';
import { FrontmatterRegistry } from '@elo/core';

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
					this.executeCommand(commandId);
				}
			}
		}

		// Update cache
		this.previousFrontmatter[filePath] = { ...currentFrontmatter };
	}

	private async executeCommand(commandId: string) {
		// Resolve command ID - if no prefix, check if it's a plugin command
		let finalCommandId = commandId;
		// @ts-ignore
		let command = this.app.commands.findCommand(finalCommandId);

		if (!command && !commandId.includes(':')) {
			finalCommandId = `elocuency:${commandId}`;
			// @ts-ignore
			command = this.app.commands.findCommand(finalCommandId);
		}

		if (command) {
			try {
				// console.log(`[FrontmatterEventService] Executing ${finalCommandId}`);
				if (command.callback) {
					await command.callback();
				} else if (command.editorCallback) {
					// Check if active view is matching?? For now just try to get active editor
					const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (activeView) {
						await command.editorCallback(activeView.editor, activeView);
					} else {
						console.warn(
							`[FrontmatterEventService] Skipping editor command ${finalCommandId} because no active MarkdownView.`,
						);
					}
				} else if (command.checkCallback) {
					await command.checkCallback(false);
				} else {
					// @ts-ignore
					this.app.commands.executeCommandById(finalCommandId);
				}
			} catch (e) {
				console.error(`[FrontmatterEventService] Error executing command ${finalCommandId}:`, e);
			}
		} else {
			console.warn(
				`[FrontmatterEventService] Command '${commandId}' (or '${finalCommandId}') not found.`,
			);
		}
	}
}
