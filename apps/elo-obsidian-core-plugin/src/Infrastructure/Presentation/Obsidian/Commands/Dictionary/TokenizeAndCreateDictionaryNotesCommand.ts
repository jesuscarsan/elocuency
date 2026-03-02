import { App, TFile, normalizePath } from 'obsidian';
import { UnresolvedLinkGeneratorSettings } from '../../settings';
import { showMessage } from '../../Utils/Messages';
import { getActiveMarkdownView } from '../../Utils/ViewMode';

import { TranslationService } from '@elo/obsidian-plugin';

export class TokenizeAndCreateDictionaryNotesCommand {
	constructor(
		private app: App,
		private settings: UnresolvedLinkGeneratorSettings,
		private translationService: TranslationService,
	) {}

	async execute(file?: TFile): Promise<void> {
		const activeView = getActiveMarkdownView(this.app, file);
		if (!activeView) {
			showMessage(this.translationService.t('dictionary.noActiveView'));
			return;
		}

		const targetFile = activeView.file;
		if (!targetFile) {
			showMessage(this.translationService.t('dictionary.noActiveFile'));
			return;
		}

		await this.processFile(targetFile);
	}

	private async processFile(file: TFile): Promise<void> {
		// 1. Get content and frontmatter
		const content = await this.app.vault.read(file);
		const metadata = this.app.metadataCache.getFileCache(file);
		const frontmatter = metadata?.frontmatter;

		let noteLanguage = frontmatter?.['language'];

		// If not present, default to 'en' (or maybe warn user? prompt says "tenga en cuenta el campo... language")
		// Implementation decision: if no language specified, we might skip or default. User said "tenga en cuenta el campo", implies it exists.
		// Let's default to settings.toLearnLanguage if missing, or maybe just skip.
		// The prompt says: "tenga en cuenta el campo de la nota language y busque si existe and si no crea.. : "-Diccionario/" + <language de la nota> + "-" + <el otro lenguage>"
		// <el otro lenguage> defaults to "en" (toLearnLanguage?) No, wait.
		// User said: "config general... userLanguage... toLearnLanguage".
		// And command: "-Diccionario/" + <language de la nota> + "-" + <el otro lenguage>
		// Use case logic:
		// If note is in 'en', and user is 'es', folder is 'en-es'.
		// If note is in 'fr', and user is 'es', folder is 'fr-es'.
		// So <el otro lenguage> usually refers to the User Language (native), the target translation.

		const userLanguage = this.settings.userLanguage || 'es'; // Default 'es'

		if (!noteLanguage) {
			showMessage(this.translationService.t('dictionary.metadataLanguageMissing'));
			noteLanguage = 'en';
		}

		const dictionaryFolder = `-Diccionario/${noteLanguage}-${userLanguage}`;

		// Ensure folder exists
		if (!this.app.vault.getAbstractFileByPath(dictionaryFolder)) {
			try {
				await this.app.vault.createFolder(dictionaryFolder);
			} catch (e) {
				// Ignore if it already exists (race condition)
			}
		}

		// 2. Tokenize body
		// Remove frontmatter from content first?
		// Simple way: split by --- if it starts with it.
		// Or just use the whole content, cleanup regex will handle it mostly, but keys in frontmatter might be annoying.
		// Better: extract body using metadata position.

		let body = content;
		if (metadata?.frontmatterPosition) {
			body = content.substring(metadata.frontmatterPosition.end.offset);
		}

		// Tokenize: split by non-word characters.
		// We want words.
		// Regex to match words.
		const tokens = body.toLowerCase().match(/\b[a-zA-ZÀ-ÿ]+\b/g);

		if (!tokens || tokens.length === 0) {
			showMessage(this.translationService.t('dictionary.noTokensFound'));
			return;
		}

		// Unique tokens
		const uniqueTokens = [...new Set(tokens)];
		let createdCount = 0;

		for (const token of uniqueTokens) {
			// Skip short tokens? maybe length < 2
			if (token.length < 2) continue;

			const safeTokenFilename = token;
			const filePath = `${dictionaryFolder}/${safeTokenFilename}.md`;
			const fileExists = this.app.vault.getAbstractFileByPath(filePath);

			if (!fileExists) {
				await this.app.vault.create(filePath, ''); // Empty file
				createdCount++;
			}
		}

		showMessage(
			this.translationService.t('dictionary.syncComplete', {
				count: createdCount,
				folder: dictionaryFolder,
			}),
		);
	}
}
