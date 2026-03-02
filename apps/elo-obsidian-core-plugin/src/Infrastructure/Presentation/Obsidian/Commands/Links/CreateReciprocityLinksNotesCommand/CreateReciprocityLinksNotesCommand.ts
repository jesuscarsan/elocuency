import { App, TFile, MarkdownView } from 'obsidian';
import {
	executeInEditMode,
	getActiveMarkdownView,
} from '@/Infrastructure/Presentation/Obsidian/Utils/ViewMode';
import { FrontmatterRegistry } from '@elo/core';
import { GenericFuzzySuggestModal } from '@elo/obsidian-plugin';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';

interface PersonMatch {
	file: TFile | null; // null means "Create New"
	name: string;
	description: string;
}

import { TranslationService } from '@elo/obsidian-plugin';

export class CreateReciprocityLinksNotesCommand {
	constructor(
		private readonly app: App,
		private readonly translationService: TranslationService,
	) {}

	async execute(file?: TFile): Promise<void> {
		console.log('[CreateReciprocityLinksNotesCommand] Start');
		const view = getActiveMarkdownView(this.app, file);
		if (!view?.file) {
			showMessage('reciprocity.noActiveFile', undefined, this.translationService);
			console.log('[CreateReciprocityLinksNotesCommand] End (No active file)');
			return;
		}

		await executeInEditMode(view, async () => {
			const activeFile = view.file;
			// Additional check
			if (!activeFile) return;

			await this.processReciprocityFields(activeFile);
		});
		console.log('[CreateReciprocityLinksNotesCommand] End');
	}

	private async processReciprocityFields(sourceFile: TFile): Promise<void> {
		let sourceFrontmatter = this.app.metadataCache.getFileCache(sourceFile)?.frontmatter;
		if (!sourceFrontmatter) {
			// Reload if cache is missed, though unlikely for active file
			sourceFrontmatter = {};
		}

		const registryEntries = Object.values(FrontmatterRegistry).filter(
			(entry) => entry.reciprocityField,
		);

		for (const entry of registryEntries) {
			const fieldKey = entry.key;
			const reciprocityKey = entry.reciprocityField!;
			const amongKey = entry.amongField;
			const rawValue = sourceFrontmatter[fieldKey];

			if (!rawValue) continue;

			const values = Array.isArray(rawValue) ? rawValue : [rawValue];
			const cleanNames = this.extractNames(values);
			const processedFiles: TFile[] = [];

			for (const name of cleanNames) {
				const processedFile = await this.handlePersonLink(sourceFile, name, reciprocityKey);
				if (processedFile) {
					processedFiles.push(processedFile);
				}
			}

			if (amongKey && processedFiles.length > 1) {
				await this.processAmongFields(processedFiles, amongKey);
			}
		}
	}

	private extractNames(values: any[]): string[] {
		return values
			.filter((v) => typeof v === 'string')
			.map((v) =>
				v
					.replace(/\[\[|\]\]/g, '')
					.split('|')[0]
					.trim(),
			) // Remove wikilinks and alias
			.filter((v) => v.length > 0);
	}

	private async handlePersonLink(
		sourceFile: TFile,
		personName: string,
		reciprocityKey: string,
	): Promise<TFile | null> {
		let targetFile = await this.findNoteForPerson(personName);

		if (!targetFile) {
			// Fuzzy search or ask user
			targetFile = await this.resolvePersonNote(personName);
		}

		if (targetFile) {
			const currentLink = `[[${targetFile.basename}]]`;

			// Check if source file needs updating (e.g. if we resolved a fuzzy match to a different name)
			// But requirement says: "siempre contienen links internos".
			// If the user typed "Juan" but meant "Juan Perez", we might want to update source.
			// For now, let's assume valid links or text.
			// The requirement says: "Antes de intentar crear una nueva nota, debe buscar... Si lo encuentra le muestra al usuario todas las coincidencias para que pueda seleccionarlo para modificar el link o decir que es una nota nueva."

			// Update source file loop is not explicitly requested for *every* field, but "modificar el link" implies it.
			// Let's first ensure the link in source file points to this targetFile (canonical name).
			await this.updateLinkInSource(sourceFile, personName, targetFile.basename);

			// Update target file with reciprocity
			await this.addReciprocityLink(targetFile, sourceFile, reciprocityKey);

			return targetFile;
		}

		return null;
	}

	private async processAmongFields(files: TFile[], amongKey: string): Promise<void> {
		for (const file of files) {
			// For each file, all other files are "siblings" (or whatever amongKey represents)
			const others = files.filter((f) => f.path !== file.path);

			for (const other of others) {
				await this.addReciprocityLink(file, other, amongKey);
			}
		}
	}

	private async resolvePersonNote(name: string): Promise<TFile | null> {
		// Precise match first
		const preciseMatch = this.app.metadataCache.getFirstLinkpathDest(name, '');
		if (preciseMatch && this.isPersonaNote(preciseMatch)) {
			return preciseMatch;
		}

		// Fuzzy search
		const allFiles = this.app.vault.getMarkdownFiles();
		const candidates = allFiles
			.filter((file) => {
				if (file.basename.toLowerCase() === name.toLowerCase()) return true;
				if (file.basename.toLowerCase().includes(name.toLowerCase())) return true; // Loose matching
				return false;
			})
			.filter((file) => this.isPersonaNote(file)); // Must have "Personas" tag?

		// If exact match found in candidates (and is persona), return it?
		// But user wants to see matches.

		const finalCandidates: PersonMatch[] = candidates.map((file) => ({
			file: file,
			name: file.basename,
			description: file.path,
		}));

		// Allow creating new
		finalCandidates.push({
			file: null,
			name: name,
			description: 'Create new note',
		});

		// If only "Create new" and no real candidates, maybe just create?
		// But logic says "Si lo encuentra le muestra al usuario". If it doesn't find any existing, implies auto-create or still confirm?
		// Let's strictly follow: "Si lo encuentra le muestra...". If not found, maybe safe to create.
		if (candidates.length === 0) {
			// Verify if preciseMatch existed but wasn't a "Persona". If so, we might want to ask.
			// Logic: "buscar en el vault si hay otra nota con ese nombre y tag 'Personas'"
			return this.createNewPersonNote(name);
		}

		const selected = await new Promise<PersonMatch | null>((resolve) => {
			new GenericFuzzySuggestModal<PersonMatch>(
				this.app,
				finalCandidates,
				(item) => `${item.name} (${item.description})`,
				() => {},
				resolve,
				'Select a person match or create new...',
			).open();
		});

		if (selected) {
			if (selected.file) {
				return selected.file;
			} else {
				return this.createNewPersonNote(name);
			}
		}

		return null;
	}

	private isPersonaNote(file: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		const tags = cache?.frontmatter?.tags;
		if (Array.isArray(tags)) {
			return tags.includes('Personas');
		} else if (typeof tags === 'string') {
			// Comma separated or single? Usually list in YAML.
			return tags === 'Personas';
		}
		return false;
	}

	private async createNewPersonNote(name: string): Promise<TFile> {
		// Create using template "Personas/Persona"
		// I need to find this template.
		// Assuming templates are in a configured folder or I search all.
		// Let's assume standard template resolution or just look for the file.

		const templatePath = 'Personas/Persona'; // As requested
		// Need to find the actual TFile for this path.
		// Try to find it.
		let templateFile = this.app.metadataCache.getFirstLinkpathDest(templatePath, '');
		if (!templateFile) {
			// Try with extension
			templateFile = this.app.metadataCache.getFirstLinkpathDest(templatePath + '.md', '');
		}

		// If not found, search by name "Persona" in "Personas" folder?
		// Or just search "Persona.md" everywhere?
		if (!templateFile) {
			const allFiles = this.app.vault.getMarkdownFiles();
			templateFile = allFiles.find((f) => f.path.includes('Personas/Persona')) || null;
		}

		if (!templateFile) {
			showMessage('reciprocity.templateNotFound', { path: templatePath }, this.translationService);
			// Fallback: create empty or simple note
			const newFile = await this.app.vault.create(`${name}.md`, '---\ntags: [Personas]\n---\n');
			return newFile;
		}

		// Read template
		const templateContent = await this.app.vault.read(templateFile);

		// Create file
		// TODO: Where to create? Root?
		// User didn't specify folder, but PersonasNoteOrganizer might handle it later.
		// Let's create in root for now.
		let newFilePath = `${name}.md`;
		let counter = 1;
		while (await this.app.vault.adapter.exists(newFilePath)) {
			newFilePath = `${name} ${counter}.md`;
			counter++;
		}

		const newFile = await this.app.vault.create(newFilePath, templateContent);

		// Ensure "Personas" tag is present (requirement)
		await this.app.fileManager.processFrontMatter(newFile, (fm) => {
			if (!fm.tags) fm.tags = [];
			if (Array.isArray(fm.tags) && !fm.tags.includes('Personas')) {
				fm.tags.push('Personas');
			} else if (typeof fm.tags === 'string' && fm.tags !== 'Personas') {
				fm.tags = [fm.tags, 'Personas'];
			}
		});

		showMessage(
			'reciprocity.createdPersonNote',
			{ name: newFile.basename },
			this.translationService,
		);
		return newFile;
	}

	private async findNoteForPerson(name: string): Promise<TFile | null> {
		return this.app.metadataCache.getFirstLinkpathDest(name, '');
	}

	private async updateLinkInSource(
		sourceFile: TFile,
		oldName: string,
		newBasename: string,
	): Promise<void> {
		if (oldName === newBasename) return;

		// We need to replace [[oldName]] with [[newBasename]] in the specific fields?
		// Or just everywhere in frontmatter?
		// Safer to process Frontmatter
		await this.app.fileManager.processFrontMatter(sourceFile, (fm) => {
			const registryEntries = Object.values(FrontmatterRegistry).filter(
				(entry) => entry.reciprocityField,
			);
			for (const entry of registryEntries) {
				const key = entry.key;
				if (fm[key]) {
					if (Array.isArray(fm[key])) {
						fm[key] = fm[key].map((v: string) => {
							const cleanV = v
								.replace(/\[\[|\]\]/g, '')
								.split('|')[0]
								.trim();
							if (cleanV === oldName) {
								return `[[${newBasename}]]`;
							}
							return v;
						});
					} else if (typeof fm[key] === 'string') {
						const cleanV = (fm[key] as string)
							.replace(/\[\[|\]\]/g, '')
							.split('|')[0]
							.trim();
						if (cleanV === oldName) {
							fm[key] = `[[${newBasename}]]`;
						}
					}
				}
			}
		});
	}

	private async addReciprocityLink(
		targetFile: TFile,
		sourceFile: TFile,
		reciprocityKey: string,
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(targetFile, (fm) => {
			const link = `[[${sourceFile.basename}]]`;

			if (!fm[reciprocityKey]) {
				fm[reciprocityKey] = [link];
			} else {
				let current = fm[reciprocityKey];
				if (!Array.isArray(current)) {
					current = [current];
				}

				// Check if link exists (loose check for basename match)
				const exists = current.some((v: string) => v.includes(sourceFile.basename));
				if (!exists) {
					current.push(link);
				}
				fm[reciprocityKey] = current;
			}
		});
		showMessage(
			'reciprocity.updatedField',
			{
				field: reciprocityKey,
				file: targetFile.basename,
			},
			this.translationService,
		);
	}
}
