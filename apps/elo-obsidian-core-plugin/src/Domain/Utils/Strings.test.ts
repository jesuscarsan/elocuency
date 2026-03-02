import { capitalize, levenshtein, similarity } from './Strings';

describe('Strings Utility', () => {
	describe('capitalize', () => {
		it('should capitalize the first letter of a word', () => {
			expect(capitalize('test')).toBe('Test');
		});

		it('should handle already capitalized words', () => {
			expect(capitalize('Test')).toBe('Test');
		});

		it('should handle single character strings', () => {
			expect(capitalize('a')).toBe('A');
		});

		it('should handle empty strings', () => {
			expect(capitalize('')).toBe('');
		});

		it('should handle non-alphabetic first characters', () => {
			expect(capitalize('1test')).toBe('1test');
		});
	});

	describe('levenshtein', () => {
		it('should return 0 for identical strings', () => {
			expect(levenshtein('hello', 'hello')).toBe(0);
		});

		it('should return the correct distance for one substitution', () => {
			expect(levenshtein('test', 'text')).toBe(1);
		});

		it('should return the correct distance for one insertion', () => {
			expect(levenshtein('test', 'tests')).toBe(1);
		});

		it('should return the correct distance for one deletion', () => {
			expect(levenshtein('test', 'tes')).toBe(1);
		});

		it('should return the correct distance for multiple changes', () => {
			expect(levenshtein('kitten', 'sitting')).toBe(3);
		});

		it('should return string length when one string is empty', () => {
			expect(levenshtein('hello', '')).toBe(5);
			expect(levenshtein('', 'world')).toBe(5);
		});
	});

	describe('similarity', () => {
		it('should return 1.0 for identical strings', () => {
			expect(similarity('hello', 'hello')).toBe(1.0);
		});

		it('should return 0.0 for completely different strings', () => {
			expect(similarity('abc', 'xyz')).toBe(0.0);
		});

		it('should return a value between 0 and 1 for partially similar strings', () => {
			const res = similarity('hello', 'hallo');
			expect(res).toBeGreaterThan(0.5);
			expect(res).toBeLessThan(1.0);
		});

		it('should handle empty strings correctly', () => {
			expect(similarity('', '')).toBe(1.0);
		});

		it('should handle strings of different lengths (a < b)', () => {
			expect(similarity('a', 'ab')).toBe(0.5);
		});

		it('should handle strings of different lengths (a > b)', () => {
			expect(similarity('ab', 'a')).toBe(0.5);
		});
	});
});
