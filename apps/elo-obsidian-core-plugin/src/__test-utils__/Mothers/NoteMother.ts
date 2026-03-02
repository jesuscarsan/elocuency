import { Note } from '../../Domain/Models/Note';

export class NoteMother {
	static create(overrides?: Partial<Note>): Note {
		return {
			path: 'notes/test-note.md',
			content: '---\ntitle: Test Note\n---\n\nTest content',
			frontmatter: { title: 'Test Note' },
			body: 'Test content',
			...overrides,
		};
	}

	static withPath(path: string): Note {
		return this.create({ path });
	}

	static withContent(content: string): Note {
		return this.create({ content });
	}

	static withFrontmatter(frontmatter: Record<string, unknown>): Note {
		return this.create({ frontmatter });
	}
}
