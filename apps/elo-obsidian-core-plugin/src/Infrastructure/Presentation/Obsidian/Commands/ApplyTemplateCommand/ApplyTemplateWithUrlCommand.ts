import { App as ObsidianApp, TFile } from 'obsidian';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { InputModal } from '@/Infrastructure/Presentation/Obsidian/Views/Modals/InputModal';
import { UnresolvedLinkGeneratorSettings } from '@/Infrastructure/Presentation/Obsidian/settings';
import type { LlmPort } from '@elo/core';
import type { ImageEnricherService } from '@/Application/Services/ImageEnricherService';
import { getActiveMarkdownView } from '@/Infrastructure/Presentation/Obsidian/Utils/ViewMode';
import { TranslationService, ObsidianNoteManager, ObsidianUIServiceAdapter, ObsidianCommandExecutorAdapter } from '@elo/obsidian-plugin';
import { ApplyTemplateWithUrlUseCase } from '@/Application/UseCases/ApplyTemplateWithUrlUseCase';
import { ObsidianNoteRepositoryAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianNoteRepositoryAdapter';
import { ObsidianTemplateRepositoryAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianTemplateRepositoryAdapter';
import { ObsidianImageServiceAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianImageServiceAdapter';
import { ObsidianNetworkAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianNetworkAdapter';
import { PersonasNoteOrganizer } from '@/Application/Services/PersonasNoteOrganizer';

export class ApplyTemplateWithUrlCommand {
	constructor(
		private readonly llm: LlmPort,
		private readonly imageEnricher: ImageEnricherService,
		private readonly obsidian: ObsidianApp,
		private readonly settings: UnresolvedLinkGeneratorSettings,
		private readonly translationService: TranslationService,
	) {}

	async execute(targetFile?: TFile) {
		console.log('[ApplyTemplateWithUrlCommand] Start');
		const view = getActiveMarkdownView(this.obsidian, targetFile);
		const file = targetFile ?? view?.file;

		if (!file) {
			showMessage(this.translationService.t('apply.openNote'));
			return;
		}

		new InputModal(
			this.obsidian,
			this.translationService,
			{
				title: 'Apply Template with Context URL',
				label: 'Enter URL (e.g. source information)',
				placeholder: 'https://...',
				submitText: 'Next',
			},
			async (url: string) => {
				if (!url) {
					showMessage(this.translationService.t('enrich.urlRequired'));
					return;
				}

				const noteRepository = new ObsidianNoteRepositoryAdapter(this.obsidian);
				const templateRepository = new ObsidianTemplateRepositoryAdapter(this.obsidian);
				const uiService = new ObsidianUIServiceAdapter(this.obsidian, this.translationService);
				const commandExecutor = new ObsidianCommandExecutorAdapter(this.obsidian);
				const imageService = new ObsidianImageServiceAdapter(this.imageEnricher);
				const noteManager = new ObsidianNoteManager(this.obsidian);
				const personasOrganizer = new PersonasNoteOrganizer(noteManager, uiService);
				const networkAdapter = new ObsidianNetworkAdapter();
		
				const useCase = new ApplyTemplateWithUrlUseCase(
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
		
				await useCase.execute(file.path, url);

                console.log('[ApplyTemplateWithUrlCommand] End');
			},
		).open();
	}
}
