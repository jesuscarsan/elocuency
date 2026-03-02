import {
	Command,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Setting,
	App,
	TFile,
	normalizePath,
} from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import { KeepNote } from './KeepNoteTypes';

class ImportModal extends Modal {
	result: string = '';
	onSubmit: (result: string) => void;

	constructor(app: App, onSubmit: (result: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Importar Google Keep desde Takeout' });

		new Setting(contentEl)
			.setName("Ruta de la carpeta 'Keep'")
			.setDesc(
				'Ruta absoluta donde se encuentran los archivos JSON y las imágenes (ej: /Users/usuario/Downloads/Takeout/Keep)',
			)
			.addText((text) =>
				text.onChange((value) => {
					this.result = value;
				}),
			);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText('Importar')
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit(this.result);
				}),
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

import { TranslationService } from '@elo/obsidian-plugin';

export class ImportKeepTakeoutCommand {
	app: App;
	private readonly translationService: TranslationService;

	constructor(app: App, translationService: TranslationService) {
		this.app = app;
		this.translationService = translationService;
	}

	async execute() {
		new ImportModal(this.app, async (folderPath) => {
			if (!folderPath) return;
			await this.importNotes(folderPath);
		}).open();
	}

	private async importNotes(folderPath: string) {
		const notice = new Notice('Iniciando importación...', 0);

		try {
			if (!fs.existsSync(folderPath)) {
				new Notice('La carpeta especificada no existe.');
				return;
			}

			const files = fs.readdirSync(folderPath);
			const jsonFiles = files.filter((f) => f.endsWith('.json'));
			const total = jsonFiles.length;
			let current = 0;

			const attachmentsFolder = 'Keep Attachments';
			if (!(await this.app.vault.adapter.exists(attachmentsFolder))) {
				await this.app.vault.createFolder(attachmentsFolder);
			}

			for (const file of jsonFiles) {
				current++;
				notice.setMessage(`Importando nota ${current}/${total}`);

				const fullPath = path.join(folderPath, file);
				const content = fs.readFileSync(fullPath, 'utf-8');

				try {
					const note: KeepNote = JSON.parse(content);

					if (note.isTrashed) continue; // Skip trashed notes

					await this.createObsidianNote(note, folderPath, attachmentsFolder);
				} catch (e) {
					console.error(`Error parsing ${file}:`, e);
				}
			}

			new Notice(`Importación completada. ${current} notas procesadas.`);
		} catch (e) {
			console.error(e);
			new Notice('Error durante la importación. Revisa la consola.');
		} finally {
			notice.hide();
		}
	}

	private async createObsidianNote(
		note: KeepNote,
		sourceFolder: string,
		attachmentsFolder: string,
	) {
		// 1. Filename
		let filename = this.sanitizeFilename(note.title);
		if (!filename) {
			const date = new Date(note.createdTimestampUsec / 1000);
			filename = `Keep Note - ${date.toISOString().replace(/[:.]/g, '-')}`;
		}

		// Ensure unique filename
		let targetPath = `${filename}.md`;
		let counter = 1;
		while (await this.app.vault.adapter.exists(targetPath)) {
			targetPath = `${filename} (${counter}).md`;
			counter++;
		}

		// 2. Content
		let body = '';

		// Frontmatter
		const tags = note.labels?.map((l) => l.name) || [];
		if (note.color !== 'DEFAULT') tags.push(`KeepColor/${note.color}`);

		const frontmatter = [
			'---',
			`created: ${new Date(note.createdTimestampUsec / 1000).toISOString()}`,
			`updated: ${new Date(note.userEditedTimestampUsec / 1000).toISOString()}`,
			tags.length > 0 ? `tags:\n  - ${tags.join('\n  - ')}` : 'tags: []',
			'---',
			'',
		].join('\n');

		body += frontmatter;

		// Text Content
		if (note.textContent) {
			body += note.textContent + '\n\n';
		}

		// List Content
		if (note.listContent) {
			for (const item of note.listContent) {
				const check = item.isChecked ? 'x' : ' ';
				body += `- [${check}] ${item.text}\n`;
			}
			body += '\n';
		}

		// Annotations (Web links usually)
		if (note.annotations) {
			for (const ann of note.annotations) {
				if (ann.source === 'WEBLINK') {
					body += `[${ann.title}](${ann.url})\n\n`;
				}
			}
		}

		// Attachments
		if (note.attachments) {
			for (const att of note.attachments) {
				const sourceFile = path.join(sourceFolder, att.filePath);
				if (fs.existsSync(sourceFile)) {
					// Copy to vault
					const ext = path.extname(att.filePath);
					const destName = `${path.basename(att.filePath, ext)}-${Date.now()}${ext}`; // Unique name
					const destPath = `${attachmentsFolder}/${destName}`;

					const buffer = fs.readFileSync(sourceFile);
					const arrayBuffer = buffer.buffer.slice(
						buffer.byteOffset,
						buffer.byteOffset + buffer.byteLength,
					);
					await this.app.vault.createBinary(destPath, arrayBuffer);

					body += `![[${destName}]]\n`;
				}
			}
		}

		await this.app.vault.create(targetPath, body);
	}

	private sanitizeFilename(name: string): string {
		if (!name) return '';
		return name.replace(/[\\/:*?"<>|]/g, '').trim();
	}
}
