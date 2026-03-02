import { App, TFile } from 'obsidian';
import { LlmPort } from '@elo/core';
import { UnresolvedLinkGeneratorSettings } from '@/Infrastructure/Presentation/Obsidian/settings';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import {
	executeInEditMode,
	getActiveMarkdownView,
} from '@/Infrastructure/Presentation/Obsidian/Utils/ViewMode';
import { ImproveNoteWithAiUseCase } from '@/Application/UseCases/ImproveNoteWithAiUseCase';
import { ObsidianEditorAdapter } from '@elo/obsidian-plugin';

import { TranslationService } from '@elo/obsidian-plugin';

export class EnhanceByAiCommand {
	constructor(
		private readonly app: App,
		private readonly settings: UnresolvedLinkGeneratorSettings,
		private readonly llm: LlmPort,
		private readonly translationService: TranslationService,
	) {}

	async execute(targetFile?: TFile) {
		console.log('[EnhanceByAiCommand] Start');
		const view = getActiveMarkdownView(this.app, targetFile);
		if (!view?.file) {
			showMessage(this.translationService.t('enhance.openNoteToEnhance'));
			console.log('[EnhanceByAiCommand] End (No active view)');
			return;
		}

		await executeInEditMode(view, async () => {
			const editorAdapter = new ObsidianEditorAdapter(view);
			const useCase = new ImproveNoteWithAiUseCase(
				this.llm,
				editorAdapter,
				this.translationService,
			);
			await useCase.execute(showMessage);
		});
		console.log('[EnhanceByAiCommand] End');
	}
}
