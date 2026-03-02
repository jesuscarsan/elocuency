import { SettingsPort } from '@elo/core';
import ObsidianExtension from '../../Presentation/Obsidian/main';

export class ObsidianSettingsAdapter implements SettingsPort {
	constructor(private plugin: ObsidianExtension) {}

	getSpotifyClientId(): string {
		return '';
	}

	// getSpotifyClientSecret(): string {
	//     return this.plugin.settings.spotifyClientSecret;
	// }

	getSpotifyAccessToken(): string {
		return '';
	}

	getSpotifyRefreshToken(): string {
		return '';
	}

	getSpotifyTokenExpirationTime(): number {
		return 0;
	}

	getSpotifyPkceVerifier(): string {
		return '';
	}

	setSpotifyAccessToken(token: string): void {
		// No-op
	}

	setSpotifyRefreshToken(token: string): void {
		// No-op
	}

	setSpotifyTokenExpirationTime(time: number): void {
		// No-op
	}

	setSpotifyPkceVerifier(verifier: string): void {
		// No-op
	}

	getGeminiRolesFolder(): string {
		return this.plugin.settings.geminiRolesFolder;
	}

	getUserLanguage(): string {
		return this.plugin.settings.userLanguage;
	}

	getToLearnLanguage(): string {
		return this.plugin.settings.toLearnLanguage;
	}

	setUserLanguage(lang: string): void {
		this.plugin.settings.userLanguage = lang;
	}

	setToLearnLanguage(lang: string): void {
		this.plugin.settings.toLearnLanguage = lang;
	}

	async saveSettings(): Promise<void> {
		await this.plugin.saveSettings();
	}
}
