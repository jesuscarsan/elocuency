import { LlmPort, FrontmatterKeys } from '@elo/core';
import { NoteRepositoryPort } from '../../Domain/Ports/NoteRepositoryPort';
import { TemplateRepositoryPort, TemplateMatch } from '../../Domain/Ports/TemplateRepositoryPort';
import { UIServicePort, CommandExecutorPort, TranslationService } from '@elo/obsidian-plugin';
import { ImageServicePort } from '../../Domain/Ports/ImageServicePort';
import {
	formatFrontmatterBlock,
	mergeFrontmatterSuggestions,
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
	) {}

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
		const normalizedBody = mergedSplit.body;

		// Prompt URL Logic
		const promptUrl =
			config.promptUrl ||
			(mergedFrontmatter && (mergedFrontmatter['!!promptUrl'] as string)) ||
			predefinedPromptUrl;

		if (config.prompt) {
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

			// AI Enrichment
			const filename = currentNote.path.split('/').pop() || '';
			const title = filename.endsWith('.md') ? filename.slice(0, -3) : filename;
			const prompt = this.buildPrompt(
				title,
				mergedFrontmatter,
				config.prompt,
				normalizedBody,
				urlContext,
			);

			const enrichment = await this.llm.requestEnrichment({ prompt });

			if (enrichment) {
				if (enrichment.frontmatter) {
					delete enrichment.frontmatter.tags;
					delete enrichment.frontmatter.tag;
				}

				let updatedFrontmatter = mergeFrontmatterSuggestions(
					mergedFrontmatter,
					enrichment.frontmatter,
				);

				// Image Search Logic
				if (
					updatedFrontmatter &&
					Array.isArray(updatedFrontmatter[FrontmatterKeys.EloImages]) &&
					(updatedFrontmatter[FrontmatterKeys.EloImages] as any[]).length === 0
				) {
					const filename = currentNote.path.split('/').pop() || '';
					const title = filename.endsWith('.md') ? filename.slice(0, -3) : filename;
					try {
						const images = await this.imageService.searchImages(title, 3);
						if (images.length > 0) {
							updatedFrontmatter = {
								...updatedFrontmatter,
								[FrontmatterKeys.EloImages]: images,
							};
						}
					} catch (e) {
						console.error('Error searching images for template:', e);
					}
				}

				if (updatedFrontmatter) {
					finalFrontmatter = updatedFrontmatter;
				}

				// Body merging logic
				const bodyFromGemini =
					enrichment.body !== undefined && enrichment.body !== null
						? enrichment.body.trim()
						: normalizedBody || '';

				// Reconstruct content
				const frontmatterBlock = finalFrontmatter ? formatFrontmatterBlock(finalFrontmatter) : '';
				const finalBody = bodyFromGemini;
				const finalContent = [frontmatterBlock, finalBody].filter(Boolean).join('\n\n');

				// Save
				await this.noteRepository.saveNote({
					path: notePath,
					content: finalContent,
					frontmatter: (finalFrontmatter as any) || {},
					body: finalBody,
				});

				// Organize
				if (finalFrontmatter) {
					// We need to pass TFile to organizer.
					// PersonasNoteOrganizer expects TFile and Frontmatter.
					// This is where leaky abstraction bites.
					// We should update PersonasNoteOrganizer to accept NoteEntity or path.
					// For now, I might have to fetch TFile in Adapter or change Organizer.
					// I will assume Organizer accepts path + frontmatter in future refactor.
					// I'll comment this out or create a wrapper.
				}

				// Move Note (!!path)
				if (config.path) {
					const targetPath = config.path.endsWith('.md')
						? config.path
						: `${config.path.replace(/\/$/, '')}/${currentNote.path.split('/').pop()}`;
					await this.noteRepository.renameNote(notePath, targetPath);
				}

				// Execute Commands
				if (config.commands) {
					TemplateContext.activeConfig = config;
					for (const cmdId of config.commands) {
						await this.commandExecutor.executeCommand(cmdId);
					}
					TemplateContext.activeConfig = null;
				}
			}
		}
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
