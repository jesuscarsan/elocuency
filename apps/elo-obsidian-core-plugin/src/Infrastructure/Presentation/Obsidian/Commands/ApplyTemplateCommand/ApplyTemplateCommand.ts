import { App as ObsidianApp, TFile } from 'obsidian';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { UnresolvedLinkGeneratorSettings } from '@/Infrastructure/Presentation/Obsidian/settings';
import type { LlmPort } from '@elo/core';
import { PersonasNoteOrganizer } from '@/Application/Services/PersonasNoteOrganizer';
import { ObsidianNoteManager } from '@elo/obsidian-plugin';

import { ApplyTemplateUseCase } from '@/Application/UseCases/ApplyTemplateUseCase';
import { ObsidianNoteRepositoryAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianNoteRepositoryAdapter';
import { ObsidianTemplateRepositoryAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianTemplateRepositoryAdapter';
import { ObsidianUIServiceAdapter, ObsidianCommandExecutorAdapter } from '@elo/obsidian-plugin';
import { ObsidianImageServiceAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianImageServiceAdapter';
import { ObsidianNetworkAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianNetworkAdapter';
import { ImageEnricherService } from '@/Application/Services/ImageEnricherService';

import { TranslationService } from '@elo/obsidian-plugin';

export class ApplyTemplateCommand {
	constructor(
		private readonly llm: LlmPort,
		private readonly imageEnricher: ImageEnricherService,
		private readonly obsidian: ObsidianApp,
		private readonly settings: UnresolvedLinkGeneratorSettings,
		private readonly translationService: TranslationService,
	) {}

	async execute(targetFile?: TFile, promptUrl?: string) {
		console.log('[ApplyTemplateCommand] Start');

		// Legacy support for targetFile if passed, otherwise UseCase handles it via UI or current file?
		// UseCase expects notePath.
		// If targetFile is provided, we pass its path.
		// If not, we might pass active file path if available, or let UseCase handle it?
		// Re-reading UseCase: it does `this.noteRepository.getNote(targetNotePath)`.
		// If we don't pass path, we need to know what to do.
		// Command logic was: `const file = targetFile ?? view?.file;`
		// So we should resolve file here.

		let file = targetFile;
		if (!file) {
			file = this.obsidian.workspace.getActiveFile() || undefined;
		}

		if (!file) {
			showMessage('apply.openNote', undefined, this.translationService);
			return;
		}

		const noteRepository = new ObsidianNoteRepositoryAdapter(this.obsidian);
		const templateRepository = new ObsidianTemplateRepositoryAdapter(this.obsidian);
		const uiService = new ObsidianUIServiceAdapter(this.obsidian, this.translationService);
		const commandExecutor = new ObsidianCommandExecutorAdapter(this.obsidian);
		// Adapter for ImageEnricherService
		const imageService = new ObsidianImageServiceAdapter(this.imageEnricher);
		// Legacy service dependency
		// Legacy service dependency
		const noteManager = new ObsidianNoteManager(this.obsidian);
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

		await useCase.execute(file.path, promptUrl);
		console.log('[ApplyTemplateCommand] End');
	}
}
