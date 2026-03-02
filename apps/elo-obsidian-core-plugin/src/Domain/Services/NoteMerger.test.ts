import { mergeNotes } from './NoteMerger';

describe('Notes Utils', () => {
	describe('mergeNotes', () => {
		it('should merge template frontmatter and current body', () => {
			const template = '---\ntags: [t1]\n---\nTemplate body';
			const current = '---\ntitle: Current\n---\nCurrent body';

			const result = mergeNotes(template, current, false); // useTemplateBody = false

			// Flexible assertions for YAML formatting (tabs/newlines)
			expect(result).toMatch(/tags:/);
			expect(result).toMatch(/- t1/);
			expect(result).toMatch(/title: Current/);
			expect(result).toContain('Current body');
			expect(result).not.toContain('Template body');
		});

		it('should merge both bodies if useTemplateBody is true', () => {
			const template = 'Template body';
			const current = 'Current body';

			const result = mergeNotes(template, current, true);

			expect(result).toBe('Template body\n\nCurrent body');
		});
	});
});
