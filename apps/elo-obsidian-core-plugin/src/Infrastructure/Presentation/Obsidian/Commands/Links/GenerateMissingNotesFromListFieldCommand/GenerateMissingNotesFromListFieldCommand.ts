import { App, normalizePath, TFile, Notice } from 'obsidian';
import { UnresolvedLinkGeneratorSettings } from '@/Infrastructure/Presentation/Obsidian/settings';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import {
	pathExists,
	GenericFuzzySuggestModal,
	ObsidianUIServiceAdapter,
	ObsidianCommandExecutorAdapter,
} from '@elo/obsidian-plugin';
// getAllTemplateConfigs removed
import { TemplateMatch } from '@/Domain/Ports/TemplateRepositoryPort';
import { ApplyTemplateUseCase } from '@/Application/UseCases/ApplyTemplateUseCase';
import { parseFrontmatter, splitFrontmatter } from '@/Domain/Utils/FrontmatterUtils';
import { LlmPort } from '@elo/core';
import { ImageEnricherService } from '@/Application/Services/ImageEnricherService';
import { ObsidianNoteRepositoryAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianNoteRepositoryAdapter';
import { ObsidianTemplateRepositoryAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianTemplateRepositoryAdapter';
import { ObsidianImageServiceAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianImageServiceAdapter';
import { ObsidianNetworkAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianNetworkAdapter';
import { ObsidianNoteManager } from '@elo/obsidian-plugin';
import { PersonasNoteOrganizer } from '@/Application/Services/PersonasNoteOrganizer';

import { TranslationService } from '@elo/obsidian-plugin';

export class GenerateMissingNotesFromListFieldCommand {
	constructor(
		private readonly app: App,
		private readonly settings: UnresolvedLinkGeneratorSettings,
		private readonly llm: LlmPort,
		private readonly imageEnricher: ImageEnricherService,
		private readonly translationService: TranslationService,
	) {}

	async execute(file?: TFile): Promise<void> {
		console.log('[GenerateMissingNotesFromListFieldCommand] Start');
		const activeFile = file ?? this.app.workspace.getActiveFile();
		if (!activeFile) {
			showMessage('missingNotes.list.noActiveFile', undefined, this.translationService);
			return;
		}

		const content = await this.app.vault.read(activeFile);
		const split = splitFrontmatter(content);
		const frontmatter = parseFrontmatter(split.frontmatterText);

		if (!frontmatter) {
			showMessage('missingNotes.list.noFrontmatter', undefined, this.translationService);
			return;
		}

		// 1. Identify list fields
		const listFields: string[] = [];
		for (const [key, value] of Object.entries(frontmatter)) {
			if (Array.isArray(value)) {
				listFields.push(key);
			}
		}

		if (listFields.length === 0) {
			showMessage('missingNotes.list.noListFields', undefined, this.translationService);
			return;
		}

		// 2. Prompt user to select a field
		let selectedField: string | null = null;

		selectedField = await new Promise<string | null>((resolve) => {
			new GenericFuzzySuggestModal<string>(
				this.app,
				listFields,
				(item: string) => item,
				() => {},
				resolve,
			).open();
		});

		if (!selectedField) {
			// User cancelled or no selection
			return;
		}

		// 3. Extract links from the selected field
		let links: string[] = [];
		const fieldData = frontmatter[selectedField];

		if (Array.isArray(fieldData)) {
			links = fieldData
				.map((link) => this.extractLinkText(link))
				.filter((l) => l !== null) as string[];
		}

		if (links.length === 0) {
			showMessage(
				'missingNotes.list.noLinksInField',
				{ field: selectedField },
				this.translationService,
			);
			return;
		}

		// 4. Check for missing notes
		const missingNotes: string[] = [];
		for (const link of links) {
			if (!this.linkExists(link)) {
				missingNotes.push(link);
			}
		}

		if (missingNotes.length === 0) {
			showMessage('missingNotes.list.allExist', { field: selectedField }, this.translationService);
			return;
		}

		showMessage(
			'missingNotes.list.foundMissing',
			{
				count: missingNotes.length,
				field: selectedField,
			},
			this.translationService,
		);

		// 5. Ask for template
		// We reuse logic finding templates, but adapters are better.
		// We can use ObsidianTemplateRepositoryAdapter to get templates.
		const templateRepository = new ObsidianTemplateRepositoryAdapter(this.app);
		const matches = await templateRepository.getAllTemplates();

		if (matches.length === 0) {
			showMessage('missingNotes.list.noTemplates', undefined, this.translationService);
			return;
		}

		let templateResult: TemplateMatch | null = null;

		if (matches.length === 1) {
			templateResult = matches[0];
		} else {
			// We can use UI Service adapter or fallback to Modal directly.
			// Since UseCase uses UI service, let's use UI service adapter if it exposes selection modal.
			// It does: showSelectionModal.
			const uiService = new ObsidianUIServiceAdapter(this.app, this.translationService);
			templateResult = await uiService.showSelectionModal(
				this.translationService.t('apply.selectTemplate'),
				matches,
				(m) => m.template.basename,
			);
		}

		if (!templateResult) {
			showMessage('missingNotes.list.noTemplateSelected', undefined, this.translationService);
			return;
		}

		showMessage(
			'missingNotes.list.generating',
			{
				count: missingNotes.length,
				template: templateResult.template.basename,
			},
			this.translationService,
		);

		// Initialize UseCase dependencies
		const noteRepository = new ObsidianNoteRepositoryAdapter(this.app);
		const uiService = new ObsidianUIServiceAdapter(this.app, this.translationService);
		const commandExecutor = new ObsidianCommandExecutorAdapter(this.app);
		const imageService = new ObsidianImageServiceAdapter(this.imageEnricher);
		const noteManager = new ObsidianNoteManager(this.app);
		const personasOrganizer = new PersonasNoteOrganizer(noteManager, uiService);
		const networkAdapter = new ObsidianNetworkAdapter();

		const useCase = new ApplyTemplateUseCase(
			noteRepository,
			templateRepository,
			uiService,
			this.llm,
			imageService,
			commandExecutor,
			personasOrganizer,
			networkAdapter,
			this.translationService,
		);

		for (const noteName of missingNotes) {
			try {
				// Default: Same folder as active note.
				const parentPath = activeFile.parent ? activeFile.parent.path : '';
				const newFilePath = normalizePath(`${parentPath}/${noteName}.md`);

				// Double check existence to avoid race conditions or previous check failure
				if (await pathExists(this.app, newFilePath)) {
					continue;
				}

				// Create empty file
				await this.app.vault.create(newFilePath, '');

				// Apply template using UseCase public method
				await useCase.applyTemplate(newFilePath, templateResult);

				console.log(`Created and processed ${newFilePath}`);
			} catch (e) {
				console.error(`Error creating note ${noteName}:`, e);
				new Notice(`Failed to create ${noteName}`);
			}
		}

		showMessage('missingNotes.list.finished', undefined, this.translationService);
		console.log('[GenerateMissingNotesFromListFieldCommand] End');
	}

	private extractLinkText(text: string): string | null {
		// [[LinkName]] -> LinkName
		// [[LinkName|Alias]] -> LinkName
		// PlainText -> PlainText (if valid?) Assuming links are bracketed.
		// If user put just "Title", we treat it as "Title"
		if (!text) return null;

		const output = text.trim();
		if (output.startsWith('[[') && output.endsWith(']]')) {
			const content = output.slice(2, -2);
			return content.split('|')[0];
		}
		// Fallback: assume it's just text if no brackets (common in some setups?)
		// But usually Link type in frontmatter suggests brackets or "path".
		// If it's just "Name", we return "Name".
		return output;
	}

	private linkExists(linkName: string): boolean {
		// Check metadata cache for link resolution or file existence
		// linkName could be a path or just a name.
		const file = this.app.metadataCache.getFirstLinkpathDest(linkName, '');
		return !!file;
	}
}
