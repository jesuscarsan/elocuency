import { App, Notice, TFile } from 'obsidian';
import { UIServicePort } from '../../../Domain/Ports/UIServicePort';
import { TranslationService } from '../../../Domain/Interfaces/TranslationService';
import { GenericFuzzySuggestModal } from '../../Presentation/Obsidian/Views/Modals/GenericFuzzySuggestModal';

export class ObsidianUIServiceAdapter implements UIServicePort {
	constructor(
		private readonly app: App,
		private readonly translationService: TranslationService,
	) { }

	showMessage(keyOrMessage: string, args?: Record<string, any>): void {
		const message = this.translationService.t(keyOrMessage, args);
		new Notice(message);
	}

	async showSelectionModal<T>(
		placeholder: string,
		items: T[],
		labelFn: (item: T) => string,
	): Promise<T | null> {
		return new Promise<T | null>((resolve) => {
			new GenericFuzzySuggestModal<T>(
				this.app,
				items,
				labelFn,
				() => { },
				(selected: T | null) => resolve(selected),
				placeholder,
			).open();
		});
	}

	async openFile(pathOrAbsolute: string): Promise<void> {
		let path = pathOrAbsolute;
		// @ts-ignore - access to internal adapter
		if (this.app.vault.adapter.getBasePath) {
			// @ts-ignore
			const basePath = this.app.vault.adapter.getBasePath();
			if (path.startsWith(basePath)) {
				path = path.slice(basePath.length).replace(/^\/+/, '');
			}
		}

		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		} else {
			console.warn(`[UIService] File not found for opening: ${path}`);
		}
	}
}
