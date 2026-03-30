import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownCleaner } from './MarkdownCleaner';

describe('MarkdownCleaner', () => {
    let cleaner: MarkdownCleaner;

    beforeEach(() => {
        cleaner = new MarkdownCleaner();
    });

    it('should strip Obsidian links [[Link|Display]] and [[Link]]', () => {
        const raw = 'Check out [[Other Note|My Link]] and also [[Simple Note]].';
        const cleaned = cleaner.clean(raw);
        expect(cleaned).toContain('Check out My Link and also Simple Note.');
    });

    it('should remove empty frontmatter fields but keep filled ones', () => {
        const raw = `---
title: "Valid"
tags: []
empty_str: ""
null_val: null
nested:
  empty: {}
  filled: "Yes"
---
Content here.`;
        const cleaned = cleaner.clean(raw);
        expect(cleaned).toContain('title: Valid');
        expect(cleaned).toContain('nested:\n  filled: Yes');
        expect(cleaned).not.toContain('tags: []');
        expect(cleaned).not.toContain('empty_str');
        expect(cleaned).not.toContain('null_val');
    });

    it('should handle standard markdown links [Display](url)', () => {
        const raw = 'Check [Google](https://google.com).';
        const cleaned = cleaner.clean(raw);
        expect(cleaned).toBe('Check Google.');
    });

    it('should remove task markers [ ], [x], [X]', () => {
        const raw = '- [ ] To do\n- [x] Done\n- [X] Done too';
        const cleaned = cleaner.clean(raw);
        expect(cleaned).toContain('- To do');
        expect(cleaned).toContain('- Done');
        expect(cleaned).toContain('- Done too');
    });

    it('should strip images ![[image.png]] and ![](url)', () => {
        const raw = '![[Note-Image.png]]\nAn image: ![](https://example.com/img.jpg)';
        const cleaned = cleaner.clean(raw).trim();
        expect(cleaned).toBe('An image:');
    });

    it('should strip simple HTML tags', () => {
        const raw = '<div>Hello</div> <br> <p>World</p>';
        const cleaned = cleaner.clean(raw);
        expect(cleaned).toBe('Hello World');
    });

    it('should handle Obsidian callout headers', () => {
        const raw = '> [!INFO] Title\n> My content';
        const cleaned = cleaner.clean(raw);
        expect(cleaned).not.toContain('[!INFO]');
        expect(cleaned).toContain('Title\n> My content');
    });

    it('should strip world path from the context location', () => {
        const raw = 'Note content';
        const path = 'Mi mundo/Projects/Final.md';
        const cleaned = cleaner.clean(raw, { path, worldPath: 'Mi mundo' });
        // It should extract the directory without the filename
        expect(cleaned).toContain('Location: Projects/\n');
    });
});
