import { LlmPort } from '@elo/core';
import { FrontmatterKeys } from '../../Infrastructure/Presentation/Obsidian/Constants/FrontmatterRegistry';
import { NoteRepositoryPort } from '../../Domain/Ports/NoteRepositoryPort';
import { TemplateRepositoryPort, TemplateMatch } from '../../Domain/Ports/TemplateRepositoryPort';
import { UIServicePort, CommandExecutorPort, TranslationService } from '@elo/obsidian-plugin';
import { ImageServicePort } from '../../Domain/Ports/ImageServicePort';
import {
	formatFrontmatterBlock,
	applyFrontmatterUpdates,
	parseFrontmatter,
	splitFrontmatter,
} from '../../Domain/Utils/FrontmatterUtils';
import { mergeNotes } from '../../Domain/Services/NoteMerger';
import { PersonasNoteOrganizer } from '../Services/PersonasNoteOrganizer'; // Application/Service
import { TemplateContext } from '../../Infrastructure/Presentation/Obsidian/Utils/TemplateContext';

import { NetworkPort } from '../../Domain/Ports/NetworkPort';

export class ApplyTemplateUseCase {
	constructor(
		private readonly noteRepository: NoteRepositoryPort,
		private readonly templateRepository: TemplateRepositoryPort,
		private readonly uiService: UIServicePort,
		private readonly llm: LlmPort,
		private readonly imageService: ImageServicePort,
		private readonly commandExecutor: CommandExecutorPort,
		private readonly personasOrganizer: PersonasNoteOrganizer,
		private readonly networkPort: NetworkPort,
		private readonly translationService: TranslationService,
	) { }

	async execute(targetNotePath: string, promptUrl?: string) {
		console.log('[ApplyTemplateUseCase] Start');

		const note = await this.noteRepository.getNote(targetNotePath);
		if (!note) {
			this.uiService.showMessage('apply.openNote');
			return;
		}

		const matches = await this.templateRepository.getAllTemplates();

		if (matches.length === 0) {
			this.uiService.showMessage('apply.noTemplates');
			return;
		}

		let templateMatch: TemplateMatch | null = null;
		if (matches.length === 1) {
			templateMatch = matches[0];
		} else {
			templateMatch = await this.uiService.showSelectionModal(
				this.translationService.t('apply.selectTemplate'),
				matches,
				(m) => m.template.basename,
			);
		}

		if (!templateMatch) {
			this.uiService.showMessage('apply.noTemplateSelected');
			return;
		}

		await this.applyTemplate(note.path, templateMatch, promptUrl);
	}

	async applyTemplate(
		notePath: string,
		templateMatch: TemplateMatch,
		predefinedPromptUrl?: string,
	) {
		const { template } = templateMatch;
		const config = template.config;

		this.uiService.showMessage('apply.applying', { template: template.basename });

		const currentNote = await this.noteRepository.getNote(notePath);
		if (!currentNote) return;

		// Merge logic
		// We need `mergeNotes` function.
		// `mergeNotes` takes (templateContent, currentContent, false).
		const mergedContent = mergeNotes(template.content, currentNote.content, false);
		const mergedSplit = splitFrontmatter(mergedContent);
		let mergedFrontmatter = parseFrontmatter(mergedSplit.frontmatterText);

		// ... Logic continues similar to Command ...
		// Re-composition logic
		let finalFrontmatter = mergedFrontmatter;
		let finalBody = mergedSplit.body;

		const promptUrl =
			config.promptUrl ||
			(finalFrontmatter && (finalFrontmatter['!!promptUrl'] as string)) ||
			predefinedPromptUrl;

		// Move Note (!!path)
		let currentNotePath = notePath;
		if (config.path) {
			const targetPath = config.path.endsWith('.md')
				? config.path
				: `${config.path.replace(/\/$/, '')}/${currentNote.path.split('/').pop()}`;
			await this.noteRepository.renameNote(currentNotePath, targetPath);
			currentNotePath = targetPath;
		}

		// Reconstruct final merged content immediately
		const frontmatterBlock = finalFrontmatter ? formatFrontmatterBlock(finalFrontmatter) : '';
		const finalContent = [frontmatterBlock, finalBody].filter(Boolean).join('\n\n');

		// First, save the template data 
		await this.noteRepository.saveNote({
			path: currentNotePath,
			content: finalContent,
			frontmatter: (finalFrontmatter as any) || {},
			body: finalBody,
		});

		// Organize
		if (finalFrontmatter) {
			// PersonasNoteOrganizer handles organization logic
		}

		// Execute Commands sequentially
		if (config.commands) {
			TemplateContext.activeConfig = config;
			for (const cmdId of config.commands) {
				if (cmdId === 'ApplyPromptCommand') {
					await this.executePromptLogic(currentNotePath, config, promptUrl);
				} else {
					const success = await this.commandExecutor.executeCommand(cmdId);
					if (!success) {
						this.uiService.showMessage('apply.invalidCommand', { command: cmdId });
					}
				}
			}
			TemplateContext.activeConfig = null;
		}

		if (config.desambiguationSufix) {
			await this.applyDisambiguationSuffix(currentNotePath, config.desambiguationSufix);
		}
	}

	private async applyDisambiguationSuffix(currentNotePath: string, suffixTemplate: string) {
		const finalNote = await this.noteRepository.getNote(currentNotePath);
		if (!finalNote) return;

		const split = splitFrontmatter(finalNote.content);
		const finalFm = parseFrontmatter(split.frontmatterText) || {};

		let suffix = suffixTemplate;
		const matches = suffix.match(/\[(.*?)\]/g);
		if (matches) {
			for (const match of matches) {
				const field = match.slice(1, -1);
				const value = finalFm[field] === undefined || finalFm[field] === null ? '' : finalFm[field];
				suffix = suffix.replace(match, String(value));
			}
		}

		suffix = suffix.trim();
		if (suffix) {
			const folderPath = currentNotePath.includes('/') ? currentNotePath.substring(0, currentNotePath.lastIndexOf('/')) : '';
			const filename = currentNotePath.split('/').pop() || '';
			const baseName = filename.endsWith('.md') ? filename.slice(0, -3) : filename;

			const newBaseName = `${baseName} (${suffix})`;
			const newPath = folderPath ? `${folderPath}/${newBaseName}.md` : `${newBaseName}.md`;

			if (newPath !== currentNotePath) {
				await this.noteRepository.renameNote(currentNotePath, newPath);
			}
		}
	}

	private async executePromptLogic(
		notePath: string,
		config: any,
		promptUrl?: string,
	) {
		const currentNote = await this.noteRepository.getNote(notePath);
		if (!currentNote) return;

		const split = splitFrontmatter(currentNote.content);
		let finalFrontmatter: Record<string, unknown> | null =
			parseFrontmatter(split.frontmatterText) || {};
		let finalBody = split.body;

		let urlContext = '';
		if (promptUrl) {
			try {
				this.uiService.showMessage('apply.fetching', { url: promptUrl });
				urlContext = await this.networkPort.getText(promptUrl);
			} catch (e) {
				console.error('Error fetching prompt URL:', e);
				this.uiService.showMessage('apply.fetchError', { url: promptUrl });
			}
		}

		const filename = currentNote.path.split('/').pop() || '';
		const title = filename.endsWith('.md') ? filename.slice(0, -3) : filename;
		
		if (config.prompt) {
			const prompt = this.buildPrompt(
				title,
				finalFrontmatter,
				config.prompt,
				finalBody,
				urlContext,
			);

			let enrichment: any = null;
			try {
				enrichment = await this.llm.requestEnrichment({ prompt });
			} catch (e: any) {
				console.error('Error connecting to Elo Server:', e);
				this.uiService.showMessage('apply.serverError', { error: e.message || String(e) });
				return;
			}

			if (enrichment) {
				if (enrichment.frontmatter) {
					delete enrichment.frontmatter.tags;
					delete enrichment.frontmatter.tag;
				}

				finalFrontmatter = applyFrontmatterUpdates(
					finalFrontmatter as Record<string, unknown>,
					enrichment.frontmatter,
				);

				if (enrichment.body !== undefined && enrichment.body !== null) {
					finalBody = enrichment.body.trim();
				}
			}
		}

		// Perform image search if needed after AI
		if (
			finalFrontmatter &&
			Array.isArray(finalFrontmatter[FrontmatterKeys.EloImages]) &&
			(finalFrontmatter[FrontmatterKeys.EloImages] as any[]).length === 0
		) {
			try {
				const images = await this.imageService.searchImages(title, 3);
				if (images.length > 0) {
					finalFrontmatter = {
						...finalFrontmatter,
						[FrontmatterKeys.EloImages]: images,
					};
				}
			} catch (e) {
				console.error('Error searching images for template:', e);
			}
		}

		const frontmatterBlock = finalFrontmatter ? formatFrontmatterBlock(finalFrontmatter) : '';
		const finalContent = [frontmatterBlock, finalBody].filter(Boolean).join('\n\n');

		await this.noteRepository.saveNote({
			path: notePath,
			content: finalContent,
			frontmatter: (finalFrontmatter as any) || {},
			body: finalBody,
		});
	}

	private buildPrompt(
		title: string,
		currentFrontmatter: any,
		promptTemplate: string,
		currentBody: string,
		urlContext: string,
	): string {
		// Reuse logic from Command
		const frontmatterCopy = currentFrontmatter ? { ...currentFrontmatter } : {};
		delete frontmatterCopy.tags;
		const frontmatterJson = JSON.stringify(frontmatterCopy, null, 2);

		return this.translationService.t('apply.prompt', {
			title,
			frontmatterJson,
			currentBody,
			urlContext,
			promptTemplate,
		});
	}
}
