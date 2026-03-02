import { Plugin, TFile, MarkdownView, Platform } from 'obsidian';
import { DEFAULT_SETTINGS, UnresolvedLinkGeneratorSettings } from './settings';
import { DependencyContainer } from './DependencyContainer';
import { buildNoteCommands, NoteCommand } from './CommandRegistry';
import { GoogleGeminiAdapter } from '@elo/core';

import { SettingsView } from '@/Infrastructure/Presentation/Obsidian/Views/Settings/SettingsView';
import { registerImageGalleryRenderer } from '@/Infrastructure/Presentation/Obsidian/Views/Renderers/ImageGalleryRenderer';
import {
	NoteOperationsView,
	VIEW_TYPE_NOTE_OPERATIONS,
} from '@/Infrastructure/Presentation/Obsidian/Views/NoteOperations/NoteOperationsView';
import {
	ObsidianMetadataAdapter,
	ObsidianTranslationAdapter,
	TranslationService,
} from '@elo/obsidian-plugin';
import { createHeaderProgressRenderer } from './MarkdownPostProcessors/HeaderProgressRenderer';
import { createHeaderMetadataRenderer } from './MarkdownPostProcessors/HeaderMetadataRenderer';
import en from '@/I18n/locales/en';
import es from '@/I18n/locales/es';

export default class ObsidianExtension extends Plugin {
	settings: UnresolvedLinkGeneratorSettings = DEFAULT_SETTINGS;

	public noteCommands: NoteCommand[] = [];

	private container!: DependencyContainer;

	public get llm(): GoogleGeminiAdapter {
		return this.container.llm;
	}

	public translationService!: TranslationService;

	private lastActiveMarkdownFile: TFile | null = null;

	public getLastActiveMarkdownFile(): TFile | null {
		return this.lastActiveMarkdownFile;
	}

	async onload() {
		console.log(`Elocuency plugin loaded ${this.manifest.version}`);

		// Track active markdown file
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && activeFile.extension === 'md') {
			this.lastActiveMarkdownFile = activeFile;
		}

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (leaf?.view instanceof MarkdownView) {
					this.lastActiveMarkdownFile = (leaf.view as MarkdownView).file;
				}
			}),
		);

		// --- Initialization ---
		await this.loadSettings();

		// --- I18n ---
		this.translationService = new ObsidianTranslationAdapter({ en, es });

		this.container = new DependencyContainer(this.app, this.settings, this);

		if (this.settings.hideEmptyProperties) {
			document.body.classList.add('hide-empty-properties');
		}

		// --- Commands ---
		this.noteCommands = buildNoteCommands(this, this.container, this.settings);
		this.noteCommands.forEach((cmd) => {
			this.addCommand({ id: cmd.id, name: cmd.name, callback: cmd.callback });
		});

		// --- Events ---
		this.registerEvent(
			this.app.vault.on('rename', async (file, oldPath) => {
				if (file instanceof TFile) {
					new ObsidianMetadataAdapter(this.app).handleRename(file, oldPath);
				}
			}),
		);

		// --- Settings Tab & Post-Processors ---
		this.addSettingTab(new SettingsView(this.app, this));
		registerImageGalleryRenderer(this);
		this.registerMarkdownPostProcessor(
			createHeaderProgressRenderer(this.app, this.container.headerDataService),
		);
		this.registerMarkdownPostProcessor(
			createHeaderMetadataRenderer(this.app, this.container.headerDataService),
		);

		// --- Views ---
		this.registerView(VIEW_TYPE_NOTE_OPERATIONS, (leaf) => new NoteOperationsView(leaf, this));

		// --- Ribbon Icons ---
		this.addRibbonIcon('microphone', this.translationService.t('ribbon.noteOperations'), () =>
			this.activateNoteOperationsView(),
		);
	}

	onunload() {
		console.log('Elocuency plugin unloaded');
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	public getNoteCommands() {
		return this.noteCommands;
	}

	async activateNoteOperationsView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_NOTE_OPERATIONS)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({ type: VIEW_TYPE_NOTE_OPERATIONS, active: true });
				leaf = workspace.getLeavesOfType(VIEW_TYPE_NOTE_OPERATIONS)[0];
			}
		}

		if (leaf) workspace.revealLeaf(leaf);
	}
}
