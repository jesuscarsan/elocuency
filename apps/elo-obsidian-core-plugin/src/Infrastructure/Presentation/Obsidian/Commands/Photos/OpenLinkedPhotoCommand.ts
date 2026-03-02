import { App as ObsidianApp, TFile, Platform } from 'obsidian';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { getActiveMarkdownView } from '@/Infrastructure/Presentation/Obsidian/Utils/ViewMode';

import { TranslationService } from '@elo/obsidian-plugin';

export class OpenLinkedPhotoCommand {
	constructor(
		private readonly app: ObsidianApp,
		private readonly translationService: TranslationService,
	) {}

	private async tryGetFromFrontmatter(view: any): Promise<{ id: string; name: string } | null> {
		const file = view.file;
		if (!file) return null;

		// We use the cache because getting text line from frontmatter visually is hard
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter) return null;

		const candidates: string[] = [];

		const addCandidates = (key: string) => {
			const val = frontmatter[key];
			if (Array.isArray(val)) {
				candidates.push(...val);
			} else if (typeof val === 'string') {
				candidates.push(val);
			}
		};

		addCandidates('!!images');
		addCandidates('Imagenes urls');

		if (candidates.length === 0) return null;

		// Parse ID/Name from the stored link
		// Parse ID/Name from the stored link
		// Link format: elo-bridge://id=...&name=...
		const regex = /elo-bridge:\/\/id=([^&]+)&name=(.+)/;

		for (const candidate of candidates) {
			const match = candidate.match(regex);
			if (match) {
				return {
					id: decodeURIComponent(match[1]),
					name: decodeURIComponent(match[2]),
				};
			}
		}

		return null;
	}

	async execute(file?: TFile) {
		const view = getActiveMarkdownView(this.app, file);
		if (!view) {
			showMessage(this.translationService.t('photos.openNote'));
			return;
		}

		const editor = view.editor;
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);

		// 1. Try Line Regex
		// 1. Try Line Regex
		const linkRegex = /elo-bridge:\/\/id=([^&]+)&name=(.+)/;
		console.log('[Elocuency] Checking line:', line);
		const match = line.match(linkRegex);

		let id = '';
		let name = '';

		if (match) {
			id = decodeURIComponent(match[1]);
			name = decodeURIComponent(match[2]);
		} else {
			// 2. Fallback: Check Frontmatter
			console.log('[Elocuency] No link in line, checking Frontmatter...');
			const fromFrontmatter = await this.tryGetFromFrontmatter(view);
			if (fromFrontmatter) {
				id = fromFrontmatter.id;
				name = fromFrontmatter.name;
				showMessage('photos.openingPrincipalPhoto', { name }, this.translationService);
			} else {
				showMessage('photos.noPhotoLinkFound', undefined, this.translationService);
				return;
			}
		}

		if (Platform.isMobile) {
			this.handleMobile(name);
		} else {
			this.handleDesktop(id, name);
		}
	}

	private handleMobile(name: string) {
		// iOS Shortcut trigger
		// URL Scheme: shortcuts://run-shortcut?name=OpenPhoto&input=NAME
		const encodedName = encodeURIComponent(name);
		const url = `shortcuts://run-shortcut?name=OpenPhoto&input=${encodedName}`;
		window.open(url);
	}

	private handleDesktop(id: string, name: string) {
		// Dynamic require to avoid issues on non-desktop builds if any
		// mostly for safety, though Platform.isDesktop check protects logic
		const { exec } = require('child_process');

		showMessage(this.translationService.t('photos.openingPhoto'));

		// AppleScript: Try ID first, then Name
		const script = `
        set photoId to "${id}"
        set photoName to "${name}"
        
        tell application "Photos"
            activate
            set foundById to false
            
            try
                -- Try to select by ID
                if exists media item id photoId then
                    set selection to {media item id photoId}
                    set foundById to true
                end if
            end try
            
            if not foundById then
                -- Fallback to Name
                try
                    set searchResults to (every media item whose filename is photoName)
                    if (count of searchResults) > 0 then
                        set selection to {item 1 of searchResults}
                    else
                        return "ERROR: Not found by ID or Name"
                    end if
                on error
                    return "ERROR: Sarching failed"
                end try
            end if
            
            return "SUCCESS"
        end tell
        `;

		exec(`osascript -e '${script}'`, (error: any, stdout: any, stderr: any) => {
			if (error) {
				console.error(`exec error: ${error}`);
				showMessage(this.translationService.t('photos.appleScriptError'));
				return;
			}
			const result = stdout ? stdout.trim() : '';
			if (result.startsWith('ERROR')) {
				showMessage(this.translationService.t('photos.photoNotFound', { name }));
			}
		});
	}
}
