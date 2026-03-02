import { App } from 'obsidian';
import { EloServerLlmAdapter as LlmAdapter, EloServerImagesAdapter as ImagesAdapter } from '@elo/core';
import { EloServerImageSearchAdapter as ImageSearchAdapter } from '@/Infrastructure/Adapters/EloServer/EloServerImageSearchAdapter';
import { EloServerTranscriptionAdapter as TranscriptionAdapter } from '@/Infrastructure/Adapters/EloServer/EloServerTranscriptionAdapter';
import { ObsidianSettingsAdapter } from '@/Infrastructure/Adapters/Obsidian/ObsidianSettingsAdapter';
import { ObsidianHeaderDataRepository } from '@/Infrastructure/Adapters/Obsidian/ObsidianHeaderDataRepository';
import { ImageEnricherService } from '@/Application/Services/ImageEnricherService';
import { MetadataChangeListener } from './Listeners/MetadataChangeListener';
import { HeaderDataService } from '@/Application/Services/HeaderDataService';
import { UnresolvedLinkGeneratorSettings } from './settings';

/**
 * Simple dependency container that creates and holds all shared services/adapters.
 * No DI framework — just a class that groups dependency creation.
 */
export class DependencyContainer {
	public readonly llm: LlmAdapter;
	public readonly geminiImages: ImagesAdapter;
	public readonly imageSearch: ImageSearchAdapter;
	public readonly transcription: TranscriptionAdapter;
	public readonly imageEnricher: ImageEnricherService;
	public readonly settingsAdapter: ObsidianSettingsAdapter;
	public readonly headerDataService: HeaderDataService;

	constructor(app: App, settings: UnresolvedLinkGeneratorSettings, plugin: any) {
		const serverUrl = settings.eloServerUrl || 'http://localhost:8001';
		const serverToken = settings.eloServerToken || '';

		this.llm = new LlmAdapter(serverUrl, serverToken);
		this.geminiImages = new ImagesAdapter(serverUrl, serverToken);
		this.imageSearch = new ImageSearchAdapter(serverUrl, serverToken);
		this.transcription = new TranscriptionAdapter(serverUrl, serverToken, plugin.translationService);

		this.imageEnricher = new ImageEnricherService(this.imageSearch, plugin.translationService);
		this.settingsAdapter = new ObsidianSettingsAdapter(plugin);

		// Listeners
		new MetadataChangeListener(app);

		const headerDataRepo = new ObsidianHeaderDataRepository(app);
		this.headerDataService = new HeaderDataService(headerDataRepo);
	}
}
