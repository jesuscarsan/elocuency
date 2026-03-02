import { App as ObsidianApp, TFile } from 'obsidian';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import {
	formatFrontmatterBlock,
	parseFrontmatter,
	splitFrontmatter,
} from '@/Domain/Utils/FrontmatterUtils';
import type { LlmPort } from '@elo/core';
import type { ImageEnricherService } from '@/Application/Services/ImageEnricherService';
import { FrontmatterKeys } from '@elo/core';
import { getActiveMarkdownView } from '@/Infrastructure/Presentation/Obsidian/Utils/ViewMode';
import { InputModal } from '@/Infrastructure/Presentation/Obsidian/Views/Modals/InputModal';
import { UnresolvedLinkGeneratorSettings } from '@/Infrastructure/Presentation/Obsidian/settings';
import { ApplyTemplateCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/ApplyTemplateCommand/ApplyTemplateCommand';

import { TranslationService } from '@elo/obsidian-plugin';

export class EnrichWithPromptUrlCommand {
	constructor(
		private readonly llm: LlmPort,
		private readonly imageEnricher: ImageEnricherService,
		private readonly obsidian: ObsidianApp,
		private readonly settings: UnresolvedLinkGeneratorSettings,
		private readonly translationService: TranslationService,
	) {}

	async execute(targetFile?: TFile) {
		console.log('[EnrichWithPromptUrlCommand] Start');
		const view = getActiveMarkdownView(this.obsidian, targetFile);
		const file = targetFile ?? view?.file;

		if (!file) {
			showMessage('enrich.openNote', undefined, this.translationService);
			return;
		}

		new InputModal(
			this.obsidian,
			this.translationService,
			{
				title: this.translationService.t('enrich.enterUrl'),
				label: this.translationService.t('enrich.enterUrlLabel'),
				placeholder: 'https://...',
				submitText: this.translationService.t('enrich.enrichButton'),
			},
			async (url: string) => {
				if (!url) {
					showMessage('enrich.urlRequired', undefined, this.translationService);
					return;
				}
				await this.processUrl(file, url);
			},
		).open();
	}

	private async processUrl(file: TFile, url: string) {
		try {
			// 1. Update frontmatter
			const content = await this.obsidian.vault.read(file);
			const split = splitFrontmatter(content);
			const frontmatter = parseFrontmatter(split.frontmatterText) || {};

			frontmatter[FrontmatterKeys.EloPromptUrl] = url;

			const frontmatterBlock = formatFrontmatterBlock(frontmatter);
			// Reconstruct content. Ensure we handle empty body correctly.
			const body = split.body ? split.body.trim() : '';
			const newContent = frontmatterBlock + (body ? '\n\n' + body : '');

			await this.obsidian.vault.modify(file, newContent);

			// 2. Trigger ApplyTemplateCommand
			const command = new ApplyTemplateCommand(
				this.llm,
				this.imageEnricher,
				this.obsidian,
				this.settings,
				this.translationService,
			);

			await command.execute(file);
		} catch (error) {
			console.error('[EnrichWithPromptUrlCommand] Error:', error);
			showMessage(
				'enrich.error',
				{ error: error instanceof Error ? error.message : String(error) },
				this.translationService,
			);
		}
	}
}
