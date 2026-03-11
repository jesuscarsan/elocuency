import { App as ObsidianApp, MarkdownView, normalizePath, TFile } from 'obsidian';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { UnresolvedLinkGeneratorSettings } from '@/Infrastructure/Presentation/Obsidian/settings';
import {
	formatFrontmatterBlock,
	mergeFrontmatterSuggestions,
	parseFrontmatter,
	splitFrontmatter,
} from '@/Domain/Utils/FrontmatterUtils';
import { FrontmatterKeys } from '../../../Constants/FrontmatterRegistry';
import {
	getAllTemplateConfigs,
	TemplateMatch,
} from '@/Infrastructure/Presentation/Obsidian/Utils/TemplateConfig';
import {
	ensureFolderExists,
	ObsidianUIServiceAdapter,
	GenericFuzzySuggestModal,
} from '@elo/obsidian-plugin';
import { mergeNotes } from '@/Domain/Services/NoteMerger';
import { PersonasNoteOrganizer } from '@/Application/Services/PersonasNoteOrganizer';
import { ObsidianNoteManager } from '@elo/obsidian-plugin';
import {
	executeInEditMode,
	getActiveMarkdownView,
} from '@/Infrastructure/Presentation/Obsidian/Utils/ViewMode';
import { TemplateContext } from '@/Infrastructure/Presentation/Obsidian/Utils/TemplateContext';
import { EloServerImagesAdapter as ImagesAdapter, ImageContent } from '@elo/core';
import { ImageSourceModal } from '@/Infrastructure/Presentation/Obsidian/Views/Modals/ImageSourceModal';
import { ImageProcessor } from '@/Infrastructure/Presentation/Obsidian/Utils/ImageProcessor';
import * as fs from 'fs';
import * as path from 'path';

import { TranslationService } from '@elo/obsidian-plugin';

export class ApplyTemplateFromImageCommand {
	constructor(
		private readonly geminiImages: ImagesAdapter,
		private readonly obsidian: ObsidianApp,
		private readonly settings: UnresolvedLinkGeneratorSettings,
		private readonly translationService: TranslationService,
	) { }

	async execute(targetFile?: TFile) {
		console.log('[ApplyTemplateFromImageCommand] Start');
		const view = getActiveMarkdownView(this.obsidian, targetFile);
		// Note: We might allow running without active view if we create a new file,
		// but ApplyTemplate logic heavily relies on merging with active note.
		// If user wants to create NEW note, they should probably open a new note first?
		// "Derived from Apply Template" suggests similar UX.
		if (!view?.file) {
			showMessage(this.translationService.t('templates.openNoteToApplyTemplate'));
			console.log('[ApplyTemplateFromImageCommand] End (No active view)');
			return;
		}

		const file = view.file;

		// 1. Select Template
		const matches = await getAllTemplateConfigs(this.obsidian);

		if (matches.length === 0) {
			showMessage(this.translationService.t('templates.noTemplatesFound'));
			return;
		}

		let templateResult: TemplateMatch | null = null;
		if (matches.length === 1) {
			templateResult = matches[0];
		} else {
			templateResult = await new Promise<TemplateMatch | null>((resolve) => {
				new GenericFuzzySuggestModal<TemplateMatch>(
					this.obsidian,
					matches,
					(item) => item.templateFile.basename,
					() => { },
					resolve,
				).open();
			});
		}

		if (!templateResult) {
			showMessage(this.translationService.t('templates.noTemplateSelected'));
			return;
		}

		const { config, cleanedContent, templateFile } = templateResult;
		const promptTemplate = config.prompt;

		if (!promptTemplate) {
			showMessage(this.translationService.t('templates.noPromptInTemplate'));
			return;
		}

		// 2. Select Image
		new ImageSourceModal(this.obsidian, this.translationService, async (source) => {
			let images: ImageContent[] = [];

			try {
				if (source.type === 'clipboard') {
					const processed = await ImageProcessor.processBlob(source.blob);
					if (processed) images.push(processed);
				} else if (source.type === 'path') {
					if (fs.existsSync(source.path)) {
						const files = await fs.promises.readdir(source.path);
						for (const f of files) {
							const ext = path.extname(f).slice(1).toLowerCase();
							if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
								const buffer = await fs.promises.readFile(path.join(source.path, f));
								// Convert Buffer to ArrayBuffer
								const arrayBuffer = buffer.buffer.slice(
									buffer.byteOffset,
									buffer.byteOffset + buffer.byteLength,
								);
								const processed = await ImageProcessor.processImage(arrayBuffer, ext);
								if (processed) images.push(processed);
							}
						}
					}
				} else if (source.type === 'files') {
					for (let i = 0; i < source.files.length; i++) {
						const f = source.files[i];
						const ext = f.name.split('.').pop()?.toLowerCase() || '';
						if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
							const arrayBuffer = await f.arrayBuffer();
							const processed = await ImageProcessor.processImage(arrayBuffer, ext);
							if (processed) images.push(processed);
						}
					}
				}
			} catch (e) {
				console.error(e);
				showMessage(this.translationService.t('templates.processingImagesError'));
				return;
			}

			if (images.length === 0) {
				showMessage(this.translationService.t('templates.noValidImagesSelected'));
				return;
			}

			// 3. Process with AI
			showMessage(
				this.translationService.t('templates.applyingTemplate', {
					template: templateFile.basename,
					count: images.length,
				}),
			);

			const prompt = this.buildPrompt(file.basename, promptTemplate);

			try {
				const enrichment = await this.geminiImages.generateEnrichmentFromImages(images, prompt);

				if (enrichment) {
					await executeInEditMode(view, async () => {
						const editor = view.editor;
						// Merge template content first
						const mergedContent = mergeNotes(cleanedContent, editor.getValue(), false);
						const mergedSplit = splitFrontmatter(mergedContent);
						const mergedFrontmatter = parseFrontmatter(mergedSplit.frontmatterText);

						let finalFrontmatter = mergedFrontmatter;

						if (enrichment.frontmatter) {
							finalFrontmatter = mergeFrontmatterSuggestions(
								mergedFrontmatter,
								enrichment.frontmatter,
							);
						}

						// Recompose
						const recomposedSegments: string[] = [];
						if (finalFrontmatter) {
							recomposedSegments.push(formatFrontmatterBlock(finalFrontmatter));
						}

						if (mergedSplit.body) {
							recomposedSegments.push(mergedSplit.body);
						}

						if (enrichment.body) {
							recomposedSegments.push(enrichment.body);
						}

						const finalContent = recomposedSegments.join('\n\n');
						editor.setValue(finalContent);

						// Post-processing (Organizer, Path, Commands) - Copied from ApplyTemplateCommand
						if (finalFrontmatter) {
							const noteManager = new ObsidianNoteManager(this.obsidian);
							const uiService = new ObsidianUIServiceAdapter(this.obsidian, this.translationService);
							const organizer = new PersonasNoteOrganizer(noteManager, uiService);
							await organizer.organize(file, finalFrontmatter);
						}

						if (config.path) {
							// ... path logic ...
							// Simplified reusing existing logic if possible or copy
							try {
								const targetPath = config.path.endsWith('.md')
									? normalizePath(config.path)
									: normalizePath(`${config.path}/${file.name}`);

								await ensureFolderExists(this.obsidian, targetPath);

								const existing = this.obsidian.vault.getAbstractFileByPath(targetPath);
								if (!existing || existing === file) {
									await this.obsidian.fileManager.renameFile(file, targetPath);
								} else {
									showMessage(
										this.translationService.t('templates.fileAlreadyExists', {
											path: targetPath,
										}),
									);
								}
							} catch (e: any) {
								console.error('Error moving file based on template config:', e);
								showMessage(
									this.translationService.t('templates.moveFileError', { error: e.message }),
								);
							}
						}

						if (config.commands && Array.isArray(config.commands)) {
							TemplateContext.activeConfig = config;
							try {
								for (const commandId of config.commands) {
									// ... command execution logic ...
									(this.obsidian as any).commands.executeCommandById(commandId);
								}
							} finally {
								TemplateContext.activeConfig = null;
							}
						}
					});
					showMessage(this.translationService.t('templates.templateApplied'));
				} else {
					showMessage(this.translationService.t('templates.aiGenerationFailed'));
				}
			} catch (e) {
				console.error('Error applying template from image:', e);
				showMessage(this.translationService.t('templates.applyTemplateError'));
			}
		}).open();
		console.log('[ApplyTemplateFromImageCommand] End');
	}

	private buildPrompt(title: string, promptTemplate: string): string {
		return `${this.translationService.t('templates.promptTitle', { title })}\n\n${promptTemplate}\n\n`;
	}
}
