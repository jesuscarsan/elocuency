import { App, Modal, Setting, Notice } from 'obsidian';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { TranslationService } from '@elo/obsidian-plugin';

export type ImageSource =
	| { type: 'path'; path: string }
	| { type: 'files'; files: FileList; folderName: string }
	| { type: 'clipboard'; blob: Blob };

export class ImageSourceModal extends Modal {
	private mode: 'path' | 'files' = 'path';
	private pathResult: string = '';
	private filesResult: FileList | null = null;
	private folderNameResult: string = '';

	constructor(
		app: App,
		private translationService: TranslationService,
		private onSubmit: (result: ImageSource) => void,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: this.translationService.t('imageSource.title') });

		// --- Clipboard ---
		new Setting(contentEl)
			.setName(this.translationService.t('imageSource.clipboardTitle'))
			.setDesc(this.translationService.t('imageSource.clipboardDesc'))
			.addButton((btn) =>
				btn
					.setButtonText(this.translationService.t('imageSource.clipboardButton'))
					.setIcon('clipboard-paste')
					.onClick(async () => {
						try {
							const clipboardItems = await navigator.clipboard.read();
							for (const item of clipboardItems) {
								if (item.types.some((t) => t.startsWith('image/'))) {
									const blob = await item.getType(item.types.find((t) => t.startsWith('image/'))!);
									if (blob) {
										this.close();
										this.onSubmit({
											type: 'clipboard',
											blob: blob,
										});
										return;
									}
								}
							}
							showMessage('imageSource.noImageInClipboard', undefined, this.translationService);
						} catch (err) {
							console.error('Error reading clipboard:', err);
							showMessage('imageSource.clipboardError', undefined, this.translationService);
						}
					}),
			);

		contentEl.createEl('hr');

		// --- Folder / Files ---
		let pathInputText: any;

		const pathSetting = new Setting(contentEl)
			.setName(this.translationService.t('imageSource.folderTitle'))
			.setDesc(this.translationService.t('imageSource.folderDesc'))
			.addText((text) => {
				pathInputText = text;
				text
					.setPlaceholder(this.translationService.t('imageSource.folderPlaceholder'))
					.setValue(this.pathResult)
					.onChange((value) => {
						this.mode = 'path';
						this.pathResult = value;
						this.filesResult = null; // Clear files if path is manually typed
					});
			});

		// Hidden File Input
		const fileInput = contentEl.createEl('input', {
			type: 'file',
			attr: {
				webkitdirectory: '',
				style: 'display: none;',
			},
		});

		fileInput.addEventListener('change', () => {
			if (fileInput.files && fileInput.files.length > 0) {
				this.mode = 'files';
				this.filesResult = fileInput.files;

				// Get folder name from the first file's relative path if available
				const firstFile = fileInput.files[0];
				const relPath = firstFile.webkitRelativePath;
				// e.g., "Folder/1.jpg"
				if (relPath) {
					this.folderNameResult = relPath.split('/')[0];
				} else {
					this.folderNameResult = this.translationService.t('imageSource.selectedFolder');
				}

				const label = this.translationService.t('imageSource.filesCount', {
					folderName: this.folderNameResult,
					count: fileInput.files.length,
				});
				this.pathResult = label; // Just for display
				if (pathInputText) {
					pathInputText.setValue(label);
				}
			}
		});

		pathSetting.addButton((btn) =>
			btn.setButtonText(this.translationService.t('imageSource.browseButton')).onClick(() => {
				fileInput.click();
			}),
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(this.translationService.t('imageSource.processButton'))
				.setCta()
				.onClick(() => {
					this.close();
					if (this.mode === 'files' && this.filesResult) {
						this.onSubmit({
							type: 'files',
							files: this.filesResult,
							folderName: this.folderNameResult,
						});
					} else if (this.pathResult && this.mode === 'path') {
						this.onSubmit({
							type: 'path',
							path: this.pathResult,
						});
					}
				}),
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
