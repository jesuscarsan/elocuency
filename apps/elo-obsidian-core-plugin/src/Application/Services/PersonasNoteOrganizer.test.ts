import { vi } from 'vitest';
import { PersonasNoteOrganizer } from './PersonasNoteOrganizer';
import { createMockUIServicePort } from '../../__test-utils__/mockFactories';

describe('PersonasNoteOrganizer', () => {
	let organizer: PersonasNoteOrganizer;
	let noteManager: any;
	let uiService: any;

	beforeEach(() => {
		noteManager = {
			normalizePath: vi.fn((p) => p),
			ensureFolderExists: vi.fn(),
			renameFile: vi.fn(),
		};
		uiService = createMockUIServicePort();
		organizer = new PersonasNoteOrganizer(noteManager, uiService);
	});

	it('should NOT organize if file is NOT in personas folder', async () => {
		const file = { path: 'daily/note.md', name: 'note.md' };
		await organizer.organize(file as any, {});
		expect(noteManager.renameFile).not.toHaveBeenCalled();
	});

	it('should organize person by country and (Personas) folder', async () => {
		const file = { path: 'Personas/Pending/New Persona.md', name: 'New Persona.md' };
		const frontmatter = { Paises: '[[España]]' };

		await organizer.organize(file as any, frontmatter);

		expect(noteManager.ensureFolderExists).toHaveBeenCalled();
		expect(noteManager.renameFile).toHaveBeenCalledWith(
			file,
			'Personas/España/(Personas)/New Persona.md',
		);
		expect(uiService.showMessage).toHaveBeenCalledWith(expect.stringContaining('Nota movida'));
	});

	it('should include region and place in path if available', async () => {
		const file = { path: 'Personas/raw.md', name: 'raw.md' };
		const frontmatter = {
			Paises: ['Francia'],
			Regiones: 'Isla de Francia',
			Lugares: '[[París]]',
		};

		await organizer.organize(file as any, frontmatter);

		expect(noteManager.renameFile).toHaveBeenCalledWith(
			file,
			'Personas/Francia/Isla de Francia/París/(Personas)/raw.md',
		);
	});

	it('should NOT organize if Country is missing', async () => {
		const file = { path: 'Personas/note.md', name: 'note.md' };
		await organizer.organize(file as any, { Regiones: 'Madrid' });
		expect(noteManager.renameFile).not.toHaveBeenCalled();
	});

	it('should NOT rename if new path is same as current path', async () => {
		const file = { path: 'Personas/Spain/(Personas)/Name.md', name: 'Name.md' };
		await organizer.organize(file as any, { Paises: 'Spain' });
		expect(noteManager.renameFile).not.toHaveBeenCalled();
	});

	it('should handle errors during rename', async () => {
		const file = { path: 'Personas/raw.md', name: 'raw.md' };
		noteManager.renameFile.mockRejectedValue(new Error('Rename failed'));

		await organizer.organize(file as any, { Paises: 'Spain' });

		expect(uiService.showMessage).toHaveBeenCalledWith(expect.stringContaining('Error al mover'));
	});
});
