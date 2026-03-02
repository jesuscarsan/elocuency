import { describe, it, expect, vi } from 'vitest';
import { extractConfigFromTemplate } from './TemplateConfig';
import { TFile } from 'obsidian';

describe('TemplateConfig Utils', () => {
	describe('extractConfigFromTemplate', () => {
		it('should extract config from !! frontmatter keys and remove them from content', () => {
			// Must quote "!!" keys for the mock parser
			const content =
				'---\ntitle: Real Title\n"!!prompt": Nice prompt\n"!!path": folder/note\n---\nBody';

			const { config, cleanedContent } = extractConfigFromTemplate(content);

			expect(config.prompt).toBe('Nice prompt');
			expect(config.path).toBe('folder/note');
			expect(config.hasFrontmatter).toBe(true);
			expect(cleanedContent).toContain('title: Real Title');
			expect(cleanedContent).not.toContain('!!prompt');
			expect(cleanedContent).not.toContain('!!path');
		});

		it('should extract config from JSON blocks and remove them', () => {
			const content = 'Body\n```json\n{ "prompt": "JSON prompt", "commands": ["c1"] }\n```';

			const { config, cleanedContent } = extractConfigFromTemplate(content);

			expect(config.prompt).toBe('JSON prompt');
			expect(config.commands).toEqual(['c1']);
			expect(cleanedContent.trim()).toBe('Body');
		});

		it('should merge BOTH frontmatter and JSON block config', () => {
			const content = '---\n"!!prompt": FM prompt\n---\n```json\n{ "commands": ["c1"] }\n```';

			const { config } = extractConfigFromTemplate(content);

			expect(config.prompt).toBe('FM prompt');
			expect(config.commands).toEqual(['c1']);
		});

		it('should handle invalid JSON blocks gracefully', () => {
			const content = 'Body\n```json\n{ "invalid" }\n```'; // Fixed json to be slightly more valid but still throwing if keys missing?
			// Actually TemplateConfig catches JSON.parse error and tries new Function or warns.
			const { cleanedContent } = extractConfigFromTemplate(content);
			expect(cleanedContent).toContain('```json');
		});

		it('should handle permissive JSON (JS Object syntax)', () => {
			const content = 'Body\n```json\n{ prompt: "Permissive", commands: [\'c1\'] }\n```';
			const { config, cleanedContent } = extractConfigFromTemplate(content);

			expect(config.prompt).toBe('Permissive');
			expect(config.commands).toEqual(['c1']);
			expect(cleanedContent.trim()).toBe('Body');
		});

		it('should remove frontmatter entirely if it only contained config keys', () => {
			const content = '---\n"!!prompt": test\n---\nBody';
			const { cleanedContent } = extractConfigFromTemplate(content);
			expect(cleanedContent.trim()).toBe('Body');
		});
	});

	describe('getAllTemplateConfigs', () => {
		it('should retrieve all template configs', async () => {
			const mockApp = {
				internalPlugins: {
					getPluginById: vi.fn(),
				},
				vault: {
					getAbstractFileByPath: vi.fn(),
					read: vi.fn(),
				},
			} as any;

			// Mock templates folder
			(mockApp.internalPlugins.getPluginById as any).mockReturnValue({
				instance: { options: { folder: 'Templates' } },
			});

			const mockTemplateFile = new (TFile as any)('Templates/t1.md');
			mockTemplateFile.extension = 'md';

			const mockFolder = {
				children: [mockTemplateFile],
			};

			(mockApp.vault.getAbstractFileByPath as any).mockReturnValue(mockFolder);
			(mockApp.vault.read as any).mockResolvedValue('---\n"!!prompt": Test\n---\nBody');

			// Import locally to use mocked getAllTemplateConfigs if needed, or just test logic if exported
			// But getAllTemplateConfigs is exported. We need to mock the imports inside it?
			// The functions used are `getTemplatesFolder`, `app.vault...`
			// We can pass our mockApp.

			// We need to import getAllTemplateConfigs dynamically or from reference to avoid hoisting issues
			// if we were mocking modules, but here we just pass mockApp.
			const { getAllTemplateConfigs } = await import('./TemplateConfig');
			const results = await getAllTemplateConfigs(mockApp);

			expect(results).toHaveLength(1);
			expect(results[0].config.prompt).toBe('Test');
		});

		it('should return empty if no templates folder', async () => {
			const mockApp = {
				internalPlugins: {
					getPluginById: vi.fn().mockReturnValue(null),
				},
			} as any;
			const { getAllTemplateConfigs } = await import('./TemplateConfig');
			const results = await getAllTemplateConfigs(mockApp);
			expect(results).toEqual([]);
		});
	});
});
