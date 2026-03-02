import { App, normalizePath, TFile, Notice } from 'obsidian';
import {
	UnresolvedLinkGeneratorSettings,
	LocationStrategy,
} from '@/Infrastructure/Presentation/Obsidian/settings';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { ensureFolderExists, pathExists, GenericFuzzySuggestModal } from '@elo/obsidian-plugin';
import { similarity } from '@/Domain/Utils/Strings';

type UnresolvedLinks = Record<string, Record<string, number>>;

interface LinkSource {
	file: string; // Source file path
	originalLink: string; // The text inside [[...]]
}

interface PlannedNote {
	targetPath: string;
	linkName: string;
	sources: LinkSource[];
}

import { TranslationService } from '@elo/obsidian-plugin';

export class GenerateMissingNotesFromLinksCommand {
	constructor(
		private readonly app: App,
		private readonly settings: UnresolvedLinkGeneratorSettings,
		private readonly translationService: TranslationService,
	) {}

	async execute(file?: TFile): Promise<void> {
		console.log('[GenerateMissingNotesFromLinksCommand] Start');
		const activeFile = file ?? this.app.workspace.getActiveFile();
		if (!activeFile) {
			showMessage('missingNotes.noActiveFile', undefined, this.translationService);
			console.log('[GenerateMissingNotesFromLinksCommand] End (No active file)');
			return;
		}

		const unresolved = this.app.metadataCache.unresolvedLinks as UnresolvedLinks;

		// Group by unique Target Path
		// Map<targetPath, PlannedNote>
		const plannedCreations = new Map<string, PlannedNote>();

		// 1. Collect all unresolved links
		const unresolvedEntries = Object.entries(unresolved).filter(([sourcePath]) => {
			// Strict scope: Only process the active/passed file
			return sourcePath === activeFile.path;
		});

		if (unresolvedEntries.length === 0) {
			showMessage('missingNotes.noUnresolvedLinks', undefined, this.translationService);
			console.log('[GenerateMissingNotesFromLinksCommand] End (No unresolved links)');
			return;
		}

		for (const [sourcePath, linkMap] of unresolvedEntries) {
			const folder = this.resolveFolderForSource(
				sourcePath,
				this.settings.locationStrategy,
				this.settings.targetFolder,
			);

			for (const linkName of Object.keys(linkMap)) {
				const targetPath = this.buildTargetPath(linkName, folder);
				if (!targetPath) continue;

				if (!plannedCreations.has(targetPath)) {
					plannedCreations.set(targetPath, {
						targetPath,
						linkName,
						sources: [],
					});
				}

				plannedCreations.get(targetPath)?.sources.push({
					file: sourcePath,
					originalLink: linkName,
				});
			}
		}

		let createdPaths: string[] = [];
		let skippedPaths: string[] = [];
		let linkedPaths: string[] = [];

		// 2. Process each planned note
		for (const planning of plannedCreations.values()) {
			const { targetPath, linkName, sources } = planning;

			// Double check existence (cache might be stale or duplicates in planned)
			if (await pathExists(this.app, targetPath)) {
				skippedPaths.push(targetPath);
				continue;
			}

			// Check for similarities
			const candidates = this.findSimilarFiles(linkName);

			let chosenFile: TFile | null = null;
			let shouldCreate = true;

			if (candidates.length > 0) {
				const decision = await this.promptUserForDecision(linkName, candidates);
				if (decision === 'create') {
					shouldCreate = true;
				} else if (decision instanceof TFile) {
					shouldCreate = false;
					chosenFile = decision;
				} else {
					// Null means cancelled or skipped, maybe treat as skip?
					// Or maybe default to create? Let's treat null as skip/abort for this item
					// But simpler dx might be default to create if ignored?
					// Let's assume explicit cancellation skips.
					skippedPaths.push(linkName);
					continue;
				}
			}

			if (shouldCreate) {
				await ensureFolderExists(this.app, targetPath);
				const content = this.renderTemplate(linkName, this.settings.missingNotesTemplatePath);
				await this.app.vault.create(targetPath, content);
				createdPaths.push(targetPath);
			} else if (chosenFile) {
				// Update links in source files
				await this.updateLinksToExistingFile(sources, chosenFile);
				linkedPaths.push(chosenFile.path);
			}
		}

		showMessage(
			'missingNotes.summary',
			{
				created: createdPaths.length,
				skipped: skippedPaths.length,
				linked: linkedPaths.length,
			},
			this.translationService,
		);
		console.log('[GenerateMissingNotesFromLinksCommand] End');
	}

	private findSimilarFiles(linkName: string): TFile[] {
		const allFiles = this.app.vault.getMarkdownFiles();
		const cleanLink = this.sanitizeLinkName(linkName).toLowerCase();

		return allFiles
			.filter((file) => {
				// Exclude specific folders
				if (
					file.path.includes('/!!') ||
					file.path.startsWith('!!') ||
					file.path.includes('/.obsidian') ||
					file.path.startsWith('.obsidian')
				) {
					return false;
				}

				// Simple similarity check on basename
				const score = similarity(cleanLink, file.basename.toLowerCase());
				return score > 0.6; // Threshold can be tuned
			})
			.sort((a, b) => {
				const scoreA = similarity(cleanLink, a.basename.toLowerCase());
				const scoreB = similarity(cleanLink, b.basename.toLowerCase());
				return scoreB - scoreA;
			})
			.slice(0, 5); // Start with top 5
	}

	private async promptUserForDecision(
		linkName: string,
		candidates: TFile[],
	): Promise<TFile | 'create' | null> {
		return new Promise((resolve) => {
			const options: (TFile | { label: string; action: 'create' })[] = [
				...candidates,
				{ label: `Create new note: "${linkName}"`, action: 'create' },
			];

			const modal = new GenericFuzzySuggestModal(
				this.app,
				options,
				(item) => {
					if (item instanceof TFile) return `Link to: ${item.basename} (${item.path})`;
					return item.label;
				},
				(item) => {
					// On choose
					// Callback handled by resolve
				},
				(item) => {
					if (item === null) resolve(null);
					else if (item instanceof TFile) resolve(item);
					else resolve('create');
				},
				`Unresolved link: "[[${linkName}]]". Choose action:`,
			);
			modal.open();
		});
	}

	private async updateLinksToExistingFile(sources: LinkSource[], targetFile: TFile): Promise<void> {
		for (const source of sources) {
			const file = this.app.vault.getAbstractFileByPath(source.file);
			if (!(file instanceof TFile)) continue;

			await this.app.fileManager.processFrontMatter(file, () => {}); // Verify access?? No, need content read
			// Better use vault.process or string replace
			// processFrontMatter is only for FM.

			let content = await this.app.vault.read(file);

			// Naive replace for now - be careful about "[[Link|Alias]]" vs "[[Link]]"
			// We need to replace [[originalLink]] with [[targetFile.basename]] OR [[targetFile.basename|originalLink]] if we want to keep text
			// Usually better: [[targetFile.basename|originalAliasOrText]]

			// Regex to find the link.
			// source.originalLink is the text inside [[...]] e.g. "Foo|Bar" or "Foo"

			// If original link has pipe: [[Foo|Bar]] -> originalLink="Foo|Bar"
			// If we link to "NewFile", we want [[NewFile|Bar]]

			const escaped = source.originalLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			// Match [[originalLink]] exactly
			const regex = new RegExp(`\\[\\[${escaped}\\]\\]`, 'g');

			const newLinkBase = targetFile.basename;

			// If original had an alias part, we might want to preserve it?
			// Actually source.originalLink IS what is inside the brackets.
			// If source.originalLink was "Name|Alias", we replace "Name|Alias" with "NewName|Alias" ?
			// Or just "NewName".
			// Simplest strategy: fail safe, just point to new file.
			// If "Name|Alias", new link "NewName|Alias".

			let newLinkInner = newLinkBase;
			if (source.originalLink.includes('|')) {
				const parts = source.originalLink.split('|');
				const alias = parts.slice(1).join('|');
				newLinkInner = `${newLinkBase}|${alias}`;
			}

			content = content.replace(regex, `[[${newLinkInner}]]`);
			await this.app.vault.modify(file, content);
		}
	}

	private buildNoticeNew(created: number, skipped: number, linked: number): string {
		const parts = [];
		if (created > 0) parts.push(`Created ${created} new notes.`);
		if (linked > 0) parts.push(`Linked ${linked} to existing notes.`);
		if (skipped > 0) parts.push(`Skipped ${skipped}.`);

		if (parts.length === 0) return 'No unresolved links processed.';
		return parts.join(' ');
	}

	/* Old methods kept for compatibility if needed, or remove if unused */
	private resolveFolderForSource(
		sourcePath: string,
		strategy: LocationStrategy,
		targetFolder: string,
	): string {
		if (strategy === 'fixed-folder') {
			return targetFolder.trim();
		}

		const lastSlashIndex = sourcePath.lastIndexOf('/');
		if (lastSlashIndex === -1) {
			return '';
		}

		return sourcePath.slice(0, lastSlashIndex + 1);
	}

	private buildTargetPath(linkName: string, baseFolder: string): string | null {
		const sanitized = this.sanitizeLinkName(linkName);
		if (!sanitized) {
			return null;
		}

		const folder = baseFolder ? baseFolder.replace(/\/+$/, '') + '/' : '';
		const fullPath = `${folder}${sanitized}.md`;
		return normalizePath(fullPath);
	}

	private sanitizeLinkName(linkName: string): string {
		const name = linkName.split('|')[0]?.trim();
		if (!name) {
			return '';
		}

		return name
			.replace(/\\/g, '/')
			.replace(/:+/g, ' -')
			.replace(/[\n\r\t]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	private renderTemplate(linkName: string, template: string): string {
		const title = linkName.split('|')[1]?.trim() ?? linkName.split('|')[0]?.trim() ?? '';
		return template.replace(/{{title}}/g, title);
	}
}
