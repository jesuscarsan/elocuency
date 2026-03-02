import { App } from 'obsidian';
import { GoogleGeminiAdapter, GoogleGeminiImagesAdapter } from '@elo/core';
import { GoogleImageSearchAdapter } from '@/Infrastructure/Adapters/Google/GoogleImageSearchAdapter/GoogleImageSearchAdapter';
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
	public readonly llm: GoogleGeminiAdapter;
	public readonly geminiImages: GoogleGeminiImagesAdapter;
	public readonly imageSearch: GoogleImageSearchAdapter;
	public readonly imageEnricher: ImageEnricherService;
	public readonly settingsAdapter: ObsidianSettingsAdapter;
	public readonly headerDataService: HeaderDataService;

	constructor(app: App, settings: UnresolvedLinkGeneratorSettings, plugin: any) {
		this.llm = new GoogleGeminiAdapter(settings.geminiApiKey ?? '');
		this.geminiImages = new GoogleGeminiImagesAdapter(settings.geminiApiKey ?? '');
		this.imageSearch = new GoogleImageSearchAdapter(
			settings.googleCustomSearchApiKey ?? '',
			settings.googleCustomSearchEngineId ?? '',
			plugin.translationService,
		);
		this.imageEnricher = new ImageEnricherService(this.imageSearch, plugin.translationService);
		this.settingsAdapter = new ObsidianSettingsAdapter(plugin);

		// Listeners
		new MetadataChangeListener(app);

		const headerDataRepo = new ObsidianHeaderDataRepository(app);
		this.headerDataService = new HeaderDataService(headerDataRepo);
	}
}
