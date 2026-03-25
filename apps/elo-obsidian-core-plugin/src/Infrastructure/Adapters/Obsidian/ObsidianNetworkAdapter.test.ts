import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianNetworkAdapter } from './ObsidianNetworkAdapter';
import { requestUrl } from 'obsidian';

vi.mock('obsidian', () => ({
	requestUrl: vi.fn(),
}));

describe('ObsidianNetworkAdapter', () => {
	let adapter: ObsidianNetworkAdapter;

	beforeEach(() => {
		adapter = new ObsidianNetworkAdapter();
		vi.clearAllMocks();
	});

	it('should get text from URL', async () => {
		(requestUrl as any).mockResolvedValue({ text: 'Content' });
		const result = await adapter.getText('http://test.com');
		expect(result).toBe('Content');
		expect(requestUrl).toHaveBeenCalledWith('http://test.com');
	});

	it('should return empty string if request fails', async () => {
		(requestUrl as jest.Mock).mockResolvedValueOnce({
			status: 500,
			json: { error: 'Network error' },
		});

		const result = await adapter.postJson('https://fail.com', {});
		expect(result).toEqual({ error: 'Network error' });
	});
});
