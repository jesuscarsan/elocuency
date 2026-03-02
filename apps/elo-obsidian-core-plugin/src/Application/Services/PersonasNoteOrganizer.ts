import { NoteManagerPort, NoteItem } from '@elo/core';
import { UIServicePort } from '@elo/obsidian-plugin';

export class PersonasNoteOrganizer {
	constructor(
		private noteManager: NoteManagerPort,
		private uiService: UIServicePort,
	) {}

	async organize(file: NoteItem, frontmatter: Record<string, unknown>): Promise<void> {
		// Check if the file is in a 'personas' folder (or subfolder)
		// We look for 'personas' directory in the path.
		const pathParts = file.path.split('/');
		// Assuming 'personas' is a top-level folder or significant folder.
		// The user request says "cuando se aplique un template en la carpeta personas"
		// so we check if 'personas' is part of the path.
		const personasIndex = pathParts.findIndex((p) => p.toLowerCase() === 'personas');

		if (personasIndex === -1) {
			return;
		}

		const paises = frontmatter['Paises'];
		const regiones = frontmatter['Regiones'];

		// Get the first value from the arrays or strings
		const pais = this.getFirstValue(paises);
		const region = this.getFirstValue(regiones);
		const lugares = frontmatter['Lugares'];
		const lugar = this.getFirstValue(lugares);

		if (!pais) {
			// Can't organize without Country
			return;
		}

		// Construct the new path relative to the 'personas' folder found
		// The root for organization is the 'personas' folder.
		// pathParts.slice(0, personasIndex + 1) gives us path up to .../personas
		const basePath = pathParts.slice(0, personasIndex + 1).join('/');

		let newPathParts = [basePath, pais];
		if (region) {
			newPathParts.push(region);
		}
		if (lugar) {
			newPathParts.push(lugar);
		}

		// Add (Personas) folder
		newPathParts.push('(Personas)');

		newPathParts.push(file.name);

		const newPath = this.noteManager.normalizePath(newPathParts.join('/'));

		if (newPath === file.path) {
			return;
		}

		try {
			await this.noteManager.ensureFolderExists(newPath);
			await this.noteManager.renameFile(file, newPath);
			this.uiService.showMessage(`Nota movida a: ${newPath}`);
		} catch (error) {
			console.error('Error moving persona note:', error);
			this.uiService.showMessage(`Error al mover la nota: ${(error as Error).message}`);
		}
	}

	private getFirstValue(value: unknown): string | null {
		let result: string | null = null;

		if (typeof value === 'string') {
			result = value;
		} else if (Array.isArray(value) && value.length > 0) {
			const first = value[0];
			if (typeof first === 'string') {
				result = first;
			}
		}

		if (result) {
			return result.replace(/\[\[/g, '').replace(/\]\]/g, '').trim();
		}

		return null;
	}
}
