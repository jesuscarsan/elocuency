import { Plugin, TFile, MarkdownView, Platform, requestUrl } from 'obsidian';
import { DEFAULT_SETTINGS, UnresolvedLinkGeneratorSettings } from './settings';
import { DependencyContainer } from './DependencyContainer';
import { buildNoteCommands, NoteCommand } from './CommandRegistry';
import { SettingsView } from '@/Infrastructure/Presentation/Obsidian/Views/Settings/SettingsView';
import { registerImageGalleryRenderer } from '@/Infrastructure/Presentation/Obsidian/Views/Renderers/ImageGalleryRenderer';
import {
	NoteOperationsView,
	VIEW_TYPE_NOTE_OPERATIONS,
} from '@/Infrastructure/Presentation/Obsidian/Views/NoteOperations/NoteOperationsView';
import {
	LiveChatView,
	VIEW_TYPE_LIVE_CHAT,
} from '@/Infrastructure/Presentation/Obsidian/Views/NoteOperations/LiveChatView';
import {
	ObsidianMetadataAdapter,
	ObsidianTranslationAdapter,
	TranslationService,
} from '@elo/obsidian-plugin';
import { createHeaderProgressRenderer } from './MarkdownPostProcessors/HeaderProgressRenderer';
import { createHeaderMetadataRenderer } from './MarkdownPostProcessors/HeaderMetadataRenderer';
import en from '@/I18n/locales/en';
import es from '@/I18n/locales/es';
import { EloServerLlmAdapter as LlmAdapter, setTagFolderMapping } from '@elo/core';
import { setFrontmatterRegistry, FrontmatterKeys, FrontmatterRegistry, FrontmatterFieldConfig } from './Constants/FrontmatterRegistry';
import { setMyWorldConfig, MyWorldConfig, MyWorldRegistry } from './Constants/MyWorldRegistry';
import { getPlaceTypes, getPlaceTypeRegistry, PlaceTypeConfig } from './Constants/PlaceTypes';

export default class ObsidianExtension extends Plugin {
	settings: UnresolvedLinkGeneratorSettings = DEFAULT_SETTINGS;

	public noteCommands: NoteCommand[] = [];

	private container!: DependencyContainer;

	public get llm(): LlmAdapter {
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
		await this.loadAndSyncConfig();

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
		this.registerView(VIEW_TYPE_LIVE_CHAT, (leaf) => new LiveChatView(leaf, this));

		// --- Ribbon Icons ---
		this.addRibbonIcon('microphone', this.translationService.t('ribbon.noteOperations'), () =>
			this.activateNoteOperationsView(),
		);

		this.addRibbonIcon('mic', this.translationService.t('liveChat.title'), () =>
			this.activateLiveChatView(),
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
		this.container.updateSettings(this.settings);
	}

	async loadAndSyncConfig() {
		try {
			// 1. Try server config
			const serverConfig = await this.fetchConfigFromServer();
			if (serverConfig) {
				console.log('[ObsidianExtension] Config loaded from server');
				this.applyConfig(serverConfig);
				return;
			}

			// 2. Fallback to local config
			const localConfig = await this.loadLocalConfig();
			if (localConfig) {
				console.log('[ObsidianExtension] Config loaded from local memory');
				this.applyConfig(localConfig);
				return;
			}

			// 3. Last fallback: empty mappings
			console.log('[ObsidianExtension] No config found, using defaults');
			this.applyConfig({});
		} catch (e) {
			console.error('[ObsidianExtension] Error in loadAndSyncConfig', e);
			this.applyConfig({});
		}
	}

	private async fetchConfigFromServer(): Promise<any | null> {
		const serverUrl = this.settings.eloServerUrl || 'http://localhost:8001';
		const serverToken = this.settings.eloServerToken || '';
		const url = `${serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl}/api/config/json`;

		try {
			const response = await requestUrl({
				url,
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${serverToken}`,
				},
			});

			if (response.status === 200) {
				return response.json;
			}
			return null;
		} catch (e) {
			console.warn('[ObsidianExtension] Failed to fetch config from server', e);
			return null;
		}
	}

	private async loadLocalConfig(): Promise<any | null> {
		const configPath = 'elo-config.json';
		try {
			const exists = await this.app.vault.adapter.exists(configPath);
			if (exists) {
				const content = await this.app.vault.adapter.read(configPath);
				return JSON.parse(content);
			}
		} catch (e) {
			console.warn('[ObsidianExtension] Failed to load local elo-config.json', e);
		}
		return null;
	}

	private applyConfig(config: any) {
		console.log('[ObsidianExtension] Applying config:', config);

		// Sync mapping
		if (config.tagFolderMapping) {
			setTagFolderMapping(config.tagFolderMapping);
			console.log('[ObsidianExtension] TagFolderMapping initialized:', Object.keys(config.tagFolderMapping));
		} else {
			setTagFolderMapping({});
		}

		if (config.frontmatterRegistry) {
			setFrontmatterRegistry(config.frontmatterRegistry);
			console.log('[ObsidianExtension] FrontmatterRegistry initialized:', Object.keys(config.frontmatterRegistry));
		} else {
			setFrontmatterRegistry({});
		}

		if (config.myWorldPath) {
			setMyWorldConfig(config.myWorldPath);
			console.log('[ObsidianExtension] MyWorldConfig initialized:', config.myWorldPath);
		} else {
			setMyWorldConfig({});
		}
	}

	public getNoteCommands() {
		return this.noteCommands;
	}

	public getMyWorldConfig(): MyWorldConfig {
		return MyWorldRegistry;
	}

	public getPlaceTypes(): string[] {
		return getPlaceTypes();
	}

	public getPlaceTypeRegistry(): Partial<Record<string, PlaceTypeConfig>> {
		return getPlaceTypeRegistry();
	}

	public getFrontmatterKeys(): Record<string, string> {
		return FrontmatterKeys;
	}

	public getFrontmatterRegistry(): Record<string, FrontmatterFieldConfig> {
		return FrontmatterRegistry;
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

	async activateLiveChatView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_LIVE_CHAT)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({ type: VIEW_TYPE_LIVE_CHAT, active: true });
				leaf = workspace.getLeavesOfType(VIEW_TYPE_LIVE_CHAT)[0];
			}
		}

		if (leaf) workspace.revealLeaf(leaf);
	}
}
