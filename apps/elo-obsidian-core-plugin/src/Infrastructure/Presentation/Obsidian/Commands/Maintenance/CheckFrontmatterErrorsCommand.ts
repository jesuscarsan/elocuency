import { App as ObsidianApp, Notice, TFile } from 'obsidian';
import { TranslationService } from '@elo/obsidian-plugin';

export class CheckFrontmatterErrorsCommand {
	constructor(
		private readonly app: ObsidianApp,
		private readonly translationService: TranslationService,
	) {}

	async execute() {
		const files = this.app.vault.getMarkdownFiles();
		const problematicFiles: string[] = [];

		new Notice('🔍 Scanning memory for frontmatter errors...', 3000);

		for (const file of files) {
			const content = await this.app.vault.read(file);
			if (content.startsWith('---')) {
				const parts = content.split('---');
				if (parts.length >= 3) {
					const frontmatter = parts[1];
					const lines = frontmatter.split('\n');
					const keys = new Set<string>();

					for (const line of lines) {
						// Match top-level YAML keys like "KeyName: value"
						if (line && !line.startsWith(' ') && !line.startsWith('\t') && line.includes(':')) {
							const key = line.split(':')[0].trim();
							// Check if key isn't empty and check for duplication
							if (key) {
								if (keys.has(key)) {
									problematicFiles.push(file.path);
									break; // We found an issue in this file, move to next file
								}
								keys.add(key);
							}
						}
					}
				}
			}
		}

		if (problematicFiles.length === 0) {
			new Notice('✅ No frontmatter duplicate key errors found!');
			return;
		}

		const reportPath = 'Elo Frontmatter Errors Report.md';
		const reportContent =
			'# Frontmatter Errors Report\n\n' +
			'The following files have duplicate YAML keys in their frontmatter. This typically ' +
			'happens when keys like `Exparejas:` or `Países:` are defined twice.\n' +
			'Please open these files and remove the duplicate lines to prevent errors in external tools.\n\n' +
			problematicFiles.map((path) => `- [[${path}]]`).join('\n');

		let reportFile = this.app.vault.getAbstractFileByPath(reportPath);
		if (reportFile instanceof TFile) {
			await this.app.vault.modify(reportFile, reportContent);
		} else {
			reportFile = await this.app.vault.create(reportPath, reportContent);
		}

		if (reportFile instanceof TFile) {
			await this.app.workspace.getLeaf('tab').openFile(reportFile);
		}

		new Notice(`⚠️ Found ${problematicFiles.length} files with YAML errors. Report generated.`);
	}
}
