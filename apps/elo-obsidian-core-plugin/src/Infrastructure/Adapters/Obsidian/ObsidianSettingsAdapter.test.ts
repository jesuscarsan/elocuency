import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianSettingsAdapter } from './ObsidianSettingsAdapter';

describe('ObsidianSettingsAdapter', () => {
	let adapter: ObsidianSettingsAdapter;
	let mockPlugin: any;

	beforeEach(() => {
		mockPlugin = {
			settings: {
				userLanguage: 'en',
				geminiRolesFolder: 'Personas',
			},
			saveSettings: vi.fn().mockResolvedValue(undefined),
		};
		adapter = new ObsidianSettingsAdapter(mockPlugin);
	});

	it('should get user language', () => {
		expect(adapter.getUserLanguage()).toBe('en');
	});

	it('should update user language', async () => {
		adapter.setUserLanguage('es');
		expect(mockPlugin.settings.userLanguage).toBe('es');
	});

	it('should return empty strings/0 for spotify settings for now', () => {
		expect(adapter.getSpotifyClientId()).toBe('');
		expect(adapter.getSpotifyAccessToken()).toBe('');
		expect(adapter.getSpotifyRefreshToken()).toBe('');
		expect(adapter.getSpotifyTokenExpirationTime()).toBe(0);
		expect(adapter.getSpotifyPkceVerifier()).toBe('');
	});

	it('should provide setters that do nothing for now', () => {
		adapter.setSpotifyAccessToken('t');
		adapter.setSpotifyRefreshToken('r');
		adapter.setSpotifyTokenExpirationTime(1);
		adapter.setSpotifyPkceVerifier('v');
	});

	it('should get to-learn language', () => {
		mockPlugin.settings.toLearnLanguage = 'fr';
		expect(adapter.getToLearnLanguage()).toBe('fr');
	});

	it('should get roles folder', () => {
		expect(adapter.getGeminiRolesFolder()).toBe('Personas');
	});

	it('should save settings', async () => {
		await adapter.saveSettings();
		expect(mockPlugin.saveSettings).toHaveBeenCalled();
	});
});
