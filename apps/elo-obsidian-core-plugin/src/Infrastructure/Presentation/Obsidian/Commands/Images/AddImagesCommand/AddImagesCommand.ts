import { App as ObsidianApp, MarkdownView, Notice, TFile } from 'obsidian';
import type { ImageEnricherService } from '@/Application/Services/ImageEnricherService';
import { FrontmatterKeys } from '@elo/core';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import {
	formatFrontmatterBlock,
	parseFrontmatter,
	splitFrontmatter,
} from '@/Domain/Utils/FrontmatterUtils';
import {
	executeInEditMode,
	getActiveMarkdownView,
} from '@/Infrastructure/Presentation/Obsidian/Utils/ViewMode';

import { TranslationService } from '@elo/obsidian-plugin';

export class AddImagesCommand {
	constructor(
		private readonly app: ObsidianApp,
		private readonly imageEnricher: ImageEnricherService,
		private readonly translationService: TranslationService,
	) {}

	async execute(targetFile?: TFile) {
		console.log('[AddImagesCommand] Start');
		const view = getActiveMarkdownView(this.app, targetFile);
		if (!view?.file) {
			showMessage('images.openNoteToAddImages', undefined, this.translationService);
			console.log('[AddImagesCommand] End (No active view)');
			return;
		}
		const file = view.file;

		await executeInEditMode(view, async () => {
			const currentContent = await this.app.vault.read(file);
			const split = splitFrontmatter(currentContent);
			const frontmatter = parseFrontmatter(split.frontmatterText) || {};

			const existingImages = frontmatter[FrontmatterKeys.EloImages];

			if (Array.isArray(existingImages) && existingImages.length > 0) {
				showMessage('images.noteHasImages', undefined, this.translationService);
				return;
			}

			const images = await this.imageEnricher.searchImages(file.basename, 3);

			if (images.length === 0) {
				return;
			}

			try {
				const updatedFrontmatter = {
					...frontmatter,
					[FrontmatterKeys.EloImages]: images,
				};

				const newFrontmatterBlock = formatFrontmatterBlock(updatedFrontmatter);
				const newContent = newFrontmatterBlock + '\n' + split.body;

				await this.app.vault.modify(file, newContent);
				showMessage('images.imagesAdded', { count: images.length }, this.translationService);
			} catch (error) {
				console.error(error);
				showMessage('images.errorSavingImages', undefined, this.translationService);
			}
		});
		console.log('[AddImagesCommand] End');
	}
}
