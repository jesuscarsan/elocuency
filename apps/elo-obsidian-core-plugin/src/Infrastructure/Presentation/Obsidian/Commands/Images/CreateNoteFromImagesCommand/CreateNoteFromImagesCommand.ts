import { App, Modal, Notice, Setting, MarkdownView, TFile } from 'obsidian';
import { getActiveMarkdownView } from '@/Infrastructure/Presentation/Obsidian/Utils/ViewMode';
import { GoogleGeminiImagesAdapter, ImageContent } from '@elo/core';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import * as fs from 'fs';
import * as path from 'path';
import {
	ImageSource,
	ImageSourceModal,
} from '@/Infrastructure/Presentation/Obsidian/Views/Modals/ImageSourceModal';
import { ImageProcessor } from '@/Infrastructure/Presentation/Obsidian/Utils/ImageProcessor';

import { TranslationService } from '@elo/obsidian-plugin';

export class CreateNoteFromImagesCommand {
	constructor(
		private readonly app: App,
		private readonly adapter: GoogleGeminiImagesAdapter,
		private readonly translationService: TranslationService,
	) {}

	async execute(file?: TFile) {
		console.log('[CreateNoteFromImagesCommand] Start');
		new ImageSourceModal(this.app, this.translationService, async (source) => {
			if (source.type === 'path') {
				await this.processFromPath(source.path, file);
			} else if (source.type === 'files') {
				await this.processFromFiles(source.files, source.folderName, file);
			} else if (source.type === 'clipboard') {
				// Wrap simplistic single-image processing or reuse processFromFiles logic by mocking File?
				// Or just implement processFromBlob
				await this.processFromBlob(source.blob, file);
			}
		}).open();
		console.log('[CreateNoteFromImagesCommand] End');
	}

	private async processFromBlob(blob: Blob, targetFile?: TFile) {
		const activeView = getActiveMarkdownView(this.app, targetFile);
		if (!activeView) {
			showMessage(this.translationService.t('images.noActiveNote'));
			return;
		}

		showMessage(this.translationService.t('images.processingClipboard'));

		const imageContent = await ImageProcessor.processBlob(blob);

		if (imageContent) {
			await this.generateAndAppend([imageContent], 'Clipboard', activeView);
		} else {
			showMessage(this.translationService.t('images.clipboardProcessingError'));
		}
	}

	private async processFromPath(folderPath: string, targetFile?: TFile) {
		const activeView = getActiveMarkdownView(this.app, targetFile);
		if (!activeView) {
			showMessage(this.translationService.t('images.noActiveNote'));
			return;
		}

		showMessage(this.translationService.t('images.readingFolder', { path: folderPath }));

		if (!fs.existsSync(folderPath)) {
			showMessage(this.translationService.t('images.folderNotFound'));
			return;
		}

		try {
			const files = await fs.promises.readdir(folderPath);
			const folderName = path.basename(folderPath);

			// 1. Get and sort images
			const images = files
				.filter((file) => this.isImage(file))
				.sort((a, b) => {
					// Natural sort for numbered files (e.g. 1.jpg, 2.jpg, 10.jpg)
					return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
				});

			if (images.length === 0) {
				showMessage(this.translationService.t('images.noImagesInFolder'));
				return;
			}

			// 2. Process images (resize and convert to base64)
			const imageContents: ImageContent[] = [];
			showMessage(this.translationService.t('images.foundImages', { count: images.length }));

			for (const imageName of images) {
				const fullPath = path.join(folderPath, imageName);
				try {
					const buffer = await fs.promises.readFile(fullPath);
					// Convert Buffer to ArrayBuffer
					const arrayBuffer = buffer.buffer.slice(
						buffer.byteOffset,
						buffer.byteOffset + buffer.byteLength,
					);
					const extension = path.extname(imageName).slice(1); // remove dot
					const processedImage = await ImageProcessor.processImage(arrayBuffer, extension);
					if (processedImage) {
						imageContents.push(processedImage);
					}
				} catch (error) {
					console.error(`Failed to process image ${imageName}`, error);
					showMessage(
						this.translationService.t('images.imageProcessingError', { name: imageName }),
					);
				}
			}

			await this.generateAndAppend(imageContents, folderName, activeView);
		} catch (error) {
			console.error('Error reading folder:', error);
			showMessage(this.translationService.t('images.folderReadError'));
		}
	}

	private async processFromFiles(fileList: FileList, folderName: string, targetFile?: TFile) {
		const activeView = getActiveMarkdownView(this.app, targetFile);
		if (!activeView) {
			showMessage(this.translationService.t('images.noActiveNote'));
			return;
		}

		const files = Array.from(fileList);
		// 1. Filter and sort images
		const images = files
			.filter((file) => this.isImage(file.name))
			.sort((a, b) => {
				return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
			});

		if (images.length === 0) {
			showMessage(this.translationService.t('images.noImagesInSelection'));
			return;
		}

		// 2. Process images
		const imageContents: ImageContent[] = [];
		showMessage(this.translationService.t('images.foundImages', { count: images.length }));

		for (const file of images) {
			try {
				const arrayBuffer = await file.arrayBuffer();
				const extension = this.getExtension(file.name);
				const processedImage = await ImageProcessor.processImage(arrayBuffer, extension);
				if (processedImage) {
					imageContents.push(processedImage);
				}
			} catch (error) {
				console.error(`Failed to process image ${file.name}`, error);
				showMessage(this.translationService.t('images.imageProcessingError', { name: file.name }));
			}
		}

		await this.generateAndAppend(imageContents, folderName, activeView);
	}

	private async generateAndAppend(
		imageContents: ImageContent[],
		folderName: string,
		activeView: MarkdownView,
	) {
		if (imageContents.length === 0) {
			showMessage(this.translationService.t('images.imagesProcessingFailed'));
			return;
		}

		// 3. Send to Gemini
		showMessage(this.translationService.t('images.sendingToGemini'));
		const result = await this.adapter.generateContentFromImages(imageContents);

		if (!result) {
			showMessage(this.translationService.t('images.geminiNoResponse'));
			return;
		}

		// 4. Update Active Note
		const contentToAppend = `
## ${this.translationService.t('images.transcriptionHeader', { folderName })}
${result.literal_transcription}

## ${this.translationService.t('images.analysisHeader', { folderName })}
${result.analysis}
`.trim();

		try {
			await this.app.vault.append(activeView.file!, '\n' + contentToAppend);
			showMessage(this.translationService.t('images.contentAdded'));
		} catch (error) {
			console.error('Error updating note:', error);
			showMessage(this.translationService.t('images.noteUpdateError'));
		}
	}

	private isImage(filename: string): boolean {
		const extensions = ['png', 'jpg', 'jpeg', 'webp'];
		return extensions.includes(this.getExtension(filename));
	}

	private getExtension(filename: string): string {
		const parts = filename.split('.');
		return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
	}
}
