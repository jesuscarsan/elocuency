import { ImageSearchPort } from '@elo/core';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { TranslationService } from '@elo/obsidian-plugin';

export class ImageEnricherService {
	constructor(
		private readonly imageSearch: ImageSearchPort,
		private readonly translationService: TranslationService,
	) {}

	/**
	 * Searches for images for a given query and returns them.
	 * Handles UI feedback (messages) for starting search, success, and failure.
	 *
	 * @param query The search query (usually file basename)
	 * @param maxResults Number of images to fetch
	 * @returns Array of image URLs
	 */
	async searchImages(query: string, maxResults: number = 3): Promise<string[]> {
		showMessage('images.searching', { query }, this.translationService);

		try {
			const images = await this.imageSearch.searchImages(query, maxResults);
			const uniqueImages = [...new Set(images)];

			if (uniqueImages.length === 0) {
				showMessage('images.notFound', undefined, this.translationService);
				return [];
			}

			showMessage('images.foundCount', { count: uniqueImages.length }, this.translationService);
			return uniqueImages;
		} catch (error) {
			console.error('Error searching images:', error);
			showMessage('images.searchError', undefined, this.translationService);
			return [];
		}
	}
}
