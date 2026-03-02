import { App as ObsidianApp, TFile } from 'obsidian';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { InputModal } from '@/Infrastructure/Presentation/Obsidian/Views/Modals/InputModal';
import { UnresolvedLinkGeneratorSettings } from '@/Infrastructure/Presentation/Obsidian/settings';
import type { LlmPort } from '@elo/core';
import type { ImageEnricherService } from '@/Application/Services/ImageEnricherService';
import { ApplyTemplateCommand } from './ApplyTemplateCommand';
import { getActiveMarkdownView } from '@/Infrastructure/Presentation/Obsidian/Utils/ViewMode';

import { TranslationService } from '@elo/obsidian-plugin';

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

				const applyTemplateCommand = new ApplyTemplateCommand(
					this.llm,
					this.imageEnricher,
					this.obsidian,
					this.settings,
					this.translationService,
				);

				await applyTemplateCommand.execute(file, url);
			},
		).open();
	}
}
