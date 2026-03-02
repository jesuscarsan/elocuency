import { vi } from 'vitest';
import { ImageEnricherService } from './ImageEnricherService';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { createMockTranslationService } from '@/__test-utils__/mockFactories';

// Mock the message utility
vi.mock('@/Infrastructure/Presentation/Obsidian/Utils/Messages', () => ({
	showMessage: vi.fn(),
}));

describe('ImageEnricherService', () => {
	let service: ImageEnricherService;
	let imageSearch: any;
	let translationService: any;

	beforeEach(() => {
		translationService = createMockTranslationService();
		imageSearch = {
			searchImages: vi.fn(),
		};
		service = new ImageEnricherService(imageSearch, translationService);
		vi.clearAllMocks();
	});

	it('should return empty array and show message when no images found', async () => {
		imageSearch.searchImages.mockResolvedValue([]);

		const result = await service.searchImages('query');

		expect(result).toEqual([]);
		expect(showMessage).toHaveBeenCalledWith('images.notFound');
	});

	it('should return unique images and show success message', async () => {
		const mockImages = ['url1', 'url2', 'url1']; // duplicate
		imageSearch.searchImages.mockResolvedValue(mockImages);

		const result = await service.searchImages('query');

		expect(result).toEqual(['url1', 'url2']);
		expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('images.foundCount'));
	});

	it('should return empty array and show error message on search failure', async () => {
		imageSearch.searchImages.mockRejectedValue(new Error('Network error'));

		const result = await service.searchImages('query');

		expect(result).toEqual([]);
		expect(showMessage).toHaveBeenCalledWith('images.searchError');
	});
});
