import {
	splitFrontmatter,
	parseFrontmatter,
	hasMeaningfulValue,
	mergeFrontmatterSuggestions,
	applyFrontmatterUpdates,
	formatFrontmatterBlock,
} from './FrontmatterUtils';

describe('Frontmatter Utils', () => {
	describe('splitFrontmatter', () => {
		it('should split frontmatter and body', () => {
			const content = '---\ntitle: Test\n---\nBody content';
			const result = splitFrontmatter(content);
			expect(result.frontmatterText).toBe('title: Test');
			expect(result.body).toBe('Body content');
		});

		it('should return null frontmatter if missing', () => {
			const content = 'Only body content';
			const result = splitFrontmatter(content);
			expect(result.frontmatterText).toBeNull();
			expect(result.body).toBe('Only body content');
		});
	});

	describe('parseFrontmatter', () => {
		it('should parse valid YAML', () => {
			const yaml = 'key: value\nlist: [1, 2]';
			const result = parseFrontmatter(yaml);
			expect(result).toEqual({ key: 'value', list: [1, 2] });
		});

		it('should return null for empty input', () => {
			expect(parseFrontmatter(null)).toBeNull();
			expect(parseFrontmatter('')).toBeNull();
		});
	});

	describe('hasMeaningfulValue', () => {
		it('should return true for valid values', () => {
			expect(hasMeaningfulValue('text')).toBe(true);
			expect(hasMeaningfulValue(123)).toBe(true);
			expect(hasMeaningfulValue([1])).toBe(true);
			expect(hasMeaningfulValue({ a: 1 })).toBe(true);
		});

		it('should return false for empty/null values', () => {
			expect(hasMeaningfulValue(null)).toBe(false);
			expect(hasMeaningfulValue(undefined)).toBe(false);
			expect(hasMeaningfulValue('')).toBe(false);
			expect(hasMeaningfulValue('  ')).toBe(false);
		});

		it('should return true for empty structures', () => {
			expect(hasMeaningfulValue([])).toBe(true);
			expect(hasMeaningfulValue({})).toBe(true);
		});
	});

	describe('mergeFrontmatterSuggestions', () => {
		it('should merge suggestions into current if keys are missing in current', () => {
			const current = { title: 'Existing' };
			const suggestions = { title: 'New', author: 'Author' };
			const result = mergeFrontmatterSuggestions(current, suggestions);
			expect(result).toEqual({ title: 'Existing', author: 'Author' });
		});
	});

	describe('applyFrontmatterUpdates', () => {
		it('should overwrite current with updates', () => {
			const current = { title: 'Old' };
			const updates = { title: 'New', author: 'Author' };
			const result = applyFrontmatterUpdates(current, updates);
			expect(result).toEqual({ title: 'New', author: 'Author' });
		});
	});

	describe('formatFrontmatterBlock', () => {
		it('should format object as block', () => {
			const data = { title: 'Test' };
			const result = formatFrontmatterBlock(data);
			expect(result).toBe('---\ntitle: Test\n---');
		});
	});
});
