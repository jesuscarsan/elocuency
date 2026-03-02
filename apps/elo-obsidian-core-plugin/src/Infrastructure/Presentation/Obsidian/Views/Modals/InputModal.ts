import { App, Modal, Setting } from 'obsidian';
import { TranslationService } from '@elo/obsidian-plugin';

export class InputModal extends Modal {
	private result!: string;
	private onSubmit: (result: string) => void;

	constructor(
		app: App,
		private readonly translationService: TranslationService,
		private readonly config: {
			title: string;
			label: string;
			placeholder?: string;
			submitText?: string;
			isTextArea?: boolean;
		},
		onSubmit: (result: string) => void,
	) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: this.config.title });

		new Setting(contentEl).setName(this.config.label).then((setting) => {
			if (this.config.isTextArea) {
				setting.addTextArea((text) => {
					if (this.config.placeholder) text.setPlaceholder(this.config.placeholder);
					text.inputEl.rows = 5;
					text.inputEl.style.width = '100%';
					text.onChange((value) => {
						this.result = value;
					});
				});
			} else {
				setting.addText((text) => {
					if (this.config.placeholder) text.setPlaceholder(this.config.placeholder);
					text.onChange((value) => {
						this.result = value;
					});
				});
			}
		});

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(this.config.submitText || this.translationService.t('inputModal.submit'))
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit(this.result);
				}),
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
