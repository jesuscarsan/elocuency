import { describe, it, expect, vi } from 'vitest';
import { ObsidianImageServiceAdapter } from './ObsidianImageServiceAdapter';

describe('ObsidianImageServiceAdapter', () => {
	it('should call service searchImages', async () => {
		const mockService = { searchImages: vi.fn().mockResolvedValue(['img1.jpg']) };
		const adapter = new ObsidianImageServiceAdapter(mockService as any);
		const result = await adapter.searchImages('test', 3);
		expect(result).toEqual(['img1.jpg']);
		expect(mockService.searchImages).toHaveBeenCalledWith('test', 3);
	});
});
