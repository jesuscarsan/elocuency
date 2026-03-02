import { App, Modal, Setting } from 'obsidian';
import { TranslationService } from '@elo/obsidian-plugin';

export interface Entity {
	name: string;
	type: 'Person' | 'Place' | 'Concept';
	relevance: 'High' | 'Medium' | 'Low';
}

export class EntitySelectionModal extends Modal {
	private selectedEntities: Set<Entity>;

	constructor(
		app: App,
		private readonly translationService: TranslationService,
		private entities: Entity[],
		private onConfirm: (selected: Entity[]) => void,
	) {
		super(app);
		this.selectedEntities = new Set(entities.filter((e) => e.relevance === 'High'));
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: this.translationService.t('entityModal.title') });

		this.entities.forEach((entity) => {
			new Setting(contentEl)
				.setName(`${entity.name} (${entity.type})`)
				.setDesc(
					this.translationService.t('entityModal.relevance', { relevance: entity.relevance }),
				)
				.addToggle((toggle) =>
					toggle.setValue(entity.relevance === 'High').onChange((value) => {
						if (value) {
							this.selectedEntities.add(entity);
						} else {
							this.selectedEntities.delete(entity);
						}
					}),
				);
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText(this.translationService.t('entityModal.process'))
					.setCta()
					.onClick(() => {
						this.close();
						this.onConfirm(Array.from(this.selectedEntities));
					}),
			)
			.addButton((btn) =>
				btn.setButtonText(this.translationService.t('entityModal.cancel')).onClick(() => {
					this.close();
				}),
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
