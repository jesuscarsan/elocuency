import { LlmPort } from '@elo/core';
import { NoteRepositoryPort } from '../../Domain/Ports/NoteRepositoryPort';
import { TemplateRepositoryPort, TemplateMatch } from '../../Domain/Ports/TemplateRepositoryPort';
import { UIServicePort, CommandExecutorPort, TranslationService } from '@elo/obsidian-plugin';
import { ImageServicePort } from '../../Domain/Ports/ImageServicePort';
import { parseFrontmatter, splitFrontmatter, formatFrontmatterBlock } from '../../Domain/Utils/FrontmatterUtils';
import { mergeNotes } from '../../Domain/Services/NoteMerger';
import { PersonasNoteOrganizer } from '../Services/PersonasNoteOrganizer';
import { TemplateContext } from '../../Infrastructure/Presentation/Obsidian/Utils/TemplateContext';
import { NetworkPort } from '../../Domain/Ports/NetworkPort';

export class ApplyTemplateWithUrlUseCase {
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
		console.log('[ApplyTemplateWithUrlUseCase] Start');

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
		const mergedContent = mergeNotes(template.content, currentNote.content, false);
		const mergedSplit = splitFrontmatter(mergedContent);
		let mergedFrontmatter = parseFrontmatter(mergedSplit.frontmatterText);

		let finalFrontmatter = mergedFrontmatter;
		let finalBody = mergedSplit.body;

		const promptUrl =
			config.promptUrl ||
			(finalFrontmatter && (finalFrontmatter['!!promptUrl'] as string)) ||
			predefinedPromptUrl;

		const hasApplyPromptCommand = config.commands?.includes('ApplyPromptCommand');

		if (config.prompt && !hasApplyPromptCommand) {
           await this.executePromptLogic(notePath, config, promptUrl, finalFrontmatter, finalBody);
        }

		// Execute Commands sequentially
		if (config.commands) {
			TemplateContext.activeConfig = config;
			for (const cmdId of config.commands) {
				if (cmdId === 'ApplyPromptCommand') {
					await this.executePromptLogic(notePath, config, promptUrl, finalFrontmatter, finalBody);
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
			await this.applyDisambiguationSuffix(notePath, config.desambiguationSufix);
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
		initialFrontmatter?: Record<string, unknown> | null,
		initialBody?: string,
	) {
		const currentNote = await this.noteRepository.getNote(notePath);
		if (!currentNote) return;

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
				initialFrontmatter,
				config.prompt,
				initialBody || '',
				urlContext,
			);

            console.log("Prepared prompt for Template Context URL:", prompt);
            
            try {
                this.uiService.showMessage('apply.applying', { template: config.prompt }); // Optional, just to indicate LLM is running
                const enrichment = await this.llm.requestEnrichment({ prompt });
                console.log("[ApplyTemplateWithUrlUseCase] Received LLM enrichment:", enrichment);
                
                let updatedFrontmatter = initialFrontmatter ? { ...initialFrontmatter } : {};
                let updatedBody = initialBody || '';

                if (enrichment) {
                    if (enrichment.frontmatter) {
                        delete enrichment.frontmatter.tags;
                        delete enrichment.frontmatter.tag;
                        updatedFrontmatter = { ...updatedFrontmatter, ...enrichment.frontmatter };
                    }
                    if (enrichment.body) {
                        updatedBody = updatedBody ? `${updatedBody}\n\n${enrichment.body.trim()}` : enrichment.body.trim();
                    }
                }

                const frontmatterBlock = updatedFrontmatter ? formatFrontmatterBlock(updatedFrontmatter) : '';
                const finalContent = [frontmatterBlock, updatedBody].filter(Boolean).join('\n\n');

                console.log("[ApplyTemplateWithUrlUseCase] About to save note with finalContent length:", finalContent.length);
                console.log("[ApplyTemplateWithUrlUseCase] finalContent preview:", finalContent.substring(0, 200) + '...');

                await this.noteRepository.saveNote({
                    path: currentNote.path,
                    content: finalContent,
                    frontmatter: updatedFrontmatter as any,
                    body: updatedBody
                });

                console.log("[ApplyTemplateWithUrlUseCase] Note saved successfully.");

                this.uiService.showMessage('Enrichment generated successfully (check console).');
            } catch (e: any) {
                console.error('[ApplyTemplateWithUrlUseCase] Error connecting to LLM:', e);
                this.uiService.showMessage('apply.serverError', { error: e.message || String(e) });
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
