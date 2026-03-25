import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';

export class PersonasNoteOrganizer {
	constructor(
		private noteRepository: NoteRepositoryPort,
	) {}

	async organize(noteId: string, frontmatter: Record<string, unknown>): Promise<string> {
		const pathParts = noteId.split('/');
		const personasIndex = pathParts.findIndex((p) => p.toLowerCase() === 'personas');

		if (personasIndex === -1) {
			return noteId;
		}

		const paises = frontmatter['Paises'];
		const regiones = frontmatter['Regiones'];

		const pais = this.getFirstValue(paises);
		const region = this.getFirstValue(regiones);
		const lugares = frontmatter['Lugares'];
		const lugar = this.getFirstValue(lugares);

		if (!pais) {
			return noteId;
		}

		const basePath = pathParts.slice(0, personasIndex + 1).join('/');

		let newPathParts = [basePath, pais];
		if (region) {
			newPathParts.push(region);
		}
		if (lugar) {
			newPathParts.push(lugar);
		}

		newPathParts.push('(Personas)');
		const filename = pathParts[pathParts.length - 1];
		newPathParts.push(filename);

		const newPath = newPathParts.join('/');

		if (newPath === noteId) {
			return noteId;
		}

		await this.noteRepository.renameNote(noteId, newPath);
		return newPath;
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
