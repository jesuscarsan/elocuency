import { requestUrl } from 'obsidian';
import type { ImageSearchPort } from '@elo/core';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { TranslationService } from '@elo/obsidian-plugin';

const LOG_PREFIX = '[GoogleImageSearchAdapter]';

interface GoogleSearchItem {
	link: string;
}

interface GoogleSearchResponse {
	items?: GoogleSearchItem[];
	error?: {
		message: string;
	};
}

export class GoogleImageSearchAdapter implements ImageSearchPort {
	constructor(
		private readonly apiKey: string,
		private readonly searchEngineId: string,
		private readonly translationService: TranslationService,
	) {}

	async searchImages(query: string, count: number): Promise<string[]> {
		if (!this.apiKey || !this.searchEngineId) {
			console.warn(`${LOG_PREFIX} Missing API Key or Search Engine ID.`);
			return [];
		}

		try {
			const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${this.searchEngineId}&key=${this.apiKey}&searchType=image&num=${count}`;

			const response = await requestUrl({
				url,
				method: 'GET',
			});

			const data = (response.json ?? JSON.parse(response.text)) as GoogleSearchResponse;

			if (data.error) {
				console.error(`${LOG_PREFIX} API Error: ${data.error.message}`);
				showMessage('images.apiError', { error: data.error.message }, this.translationService);
				return [];
			}

			if (!data.items || data.items.length === 0) {
				console.warn(`${LOG_PREFIX} No images found for query: "${query}"`);
				return [];
			}

			return data.items.map((item) => item.link);
		} catch (error) {
			console.error(`${LOG_PREFIX} Unexpected error`, error);
			showMessage('images.searchError', undefined, this.translationService);
			return [];
		}
	}
}
