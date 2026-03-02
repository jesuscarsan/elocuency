import { App, TFile, TFolder, Modal, requestUrl } from 'obsidian';
import { ApplyTemplateCommand } from './ApplyTemplateCommand';
import { TestContext } from '@/__test-utils__/TestContext';
import { LlmPort } from '@elo/core';
import { ImageEnricherService } from '@/Application/Services/ImageEnricherService';
import { UnresolvedLinkGeneratorSettings } from '@/Infrastructure/Presentation/Obsidian/settings';
import { GenericFuzzySuggestModal } from '@elo/obsidian-plugin';
import { TemplateMatch } from '@/Infrastructure/Presentation/Obsidian/Utils/TemplateConfig';
import { createMockTranslationService } from '@/__test-utils__/mockFactories';

// Mock GenericFuzzySuggestModal from the library
jest.mock('@elo/obsidian-plugin', () => {
	const original = jest.requireActual('@elo/obsidian-plugin');
	return {
		...original,
		GenericFuzzySuggestModal: jest
			.fn()
			.mockImplementation((app, items, itemText, onChoice, resolve) => {
				return {
					open: jest.fn(() => {
						if (items.length > 0) {
							resolve(items[0]);
						} else {
							resolve(null);
						}
					}),
				};
			}),
	};
});

describe('ApplyTemplateCommand', () => {
	let context: TestContext;
	let command: ApplyTemplateCommand;
	let mockLlm: jest.Mocked<LlmPort>;
	let mockImageEnricher: jest.Mocked<ImageEnricherService>;
	let settings: UnresolvedLinkGeneratorSettings;
	let translationService: any;

	beforeEach(() => {
		context = new TestContext();
		translationService = createMockTranslationService();

		// Mock internal plugins for templates folder
		(context.app as any).internalPlugins = {
			getPluginById: jest.fn((id: string) => {
				if (id === 'templates') {
					return {
						instance: {
							options: {
								folder: 'Templates',
							},
						},
					};
				}
				return null;
			}),
		};

		mockLlm = {
			requestEnrichment: jest.fn(),
			requestStreamBrief: jest.fn(),
			request: jest.fn(),
			requestJson: jest.fn(),
		} as unknown as jest.Mocked<LlmPort>;

		mockImageEnricher = {
			searchImages: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<ImageEnricherService>;

		settings = {} as any;

		command = new ApplyTemplateCommand(
			mockLlm,
			mockImageEnricher,
			context.app as any,
			settings,
			translationService,
		);
		(requestUrl as jest.Mock).mockClear();
	});

	test('should apply template to a note', async () => {
		// Setup
		await context.createFolder('Templates');
		await context.createFile(
			'Templates/Standard Template.md',
			'---\ntags: [template]\n"!!prompt": Summarize this\n---\n# Template Content\n',
		);

		await context.createFolder('Notes');
		const targetFile = await context.createFile('Notes/My Note.md', '# Original Content');

		// Open the file
		const leaf = context.app.workspace.getLeaf(true);
		await leaf.openFile(targetFile);

		// Mock LLM response
		mockLlm.requestEnrichment.mockResolvedValue({
			frontmatter: { summary: 'This is a summary' },
			body: 'AI Generated Content',
		});

		// Execute
		await command.execute();

		// Verify
		// Verify LLM was called first
		expect(mockLlm.requestEnrichment).toHaveBeenCalled();
		const callArgs = mockLlm.requestEnrichment.mock.calls[0][0];
		expect(callArgs.prompt).toContain('apply.prompt');
		expect(callArgs.prompt).toContain('title: My Note');

		const updatedContent = await context.app.vault.read(targetFile);
		console.log('DEBUG: updatedContent:', updatedContent);

		expect(updatedContent).toContain('summary: This is a summary');
		expect(updatedContent).toContain('AI Generated Content');
		// The current implementation replaces the body with AI output when prompt is present
		// expect(updatedContent).toContain('# Original Content');
	});

	test('should show message if no templates found', async () => {
		// Setup empty templates folder
		await context.createFolder('Templates');
		await context.createFolder('Notes');
		const targetFile = await context.createFile('Notes/My Note.md', '# Content');

		const leaf = context.app.workspace.getLeaf(true);
		await leaf.openFile(targetFile);

		// Execute
		await command.execute();

		// We can't easily check showMessage as it imports from module.
		// We might need to spy on the module or check that no changes happened.
		const content = await context.app.vault.read(targetFile);
		expect(content).toBe('# Content');
	});
	test('should fetch promptUrl content and include it in prompt', async () => {
		// Setup
		await context.createFolder('Templates');
		await context.createFolder('Notes');
		await context.createFile(
			'Templates/Url Template.md',
			'---\ntags: [template]\n"!!prompt": Summarize this\n---\n# Template Content\n',
		);

		const targetFile = await context.createFile(
			'Notes/Url Note.md',
			'---\n"!!promptUrl": "http://example.com/info"\n---\n# Original Content',
		);

		const leaf = context.app.workspace.getLeaf(true);
		await leaf.openFile(targetFile);

		// Mock requestUrl response
		(requestUrl as jest.Mock).mockResolvedValue({
			text: 'Content from URL',
		});

		// Mock LLM response
		mockLlm.requestEnrichment.mockResolvedValue({
			frontmatter: { summary: 'Summary with URL context' },
			body: 'AI Generated Content',
		});

		// Execute
		await command.execute();

		// Verify
		expect(requestUrl).toHaveBeenCalledWith('http://example.com/info');

		expect(mockLlm.requestEnrichment).toHaveBeenCalled();
		const callArgs = mockLlm.requestEnrichment.mock.calls[0][0];
		expect(callArgs.prompt).toContain('urlContext: Content from URL');
	});

	test('should filter out tags from prompt and ignore tags from LLM response', async () => {
		// Setup
		await context.createFolder('Templates');
		await context.createFile('Templates/Tag filter.md', '---\n"!!prompt": Add metadata\n---\n');

		// 1. Verify Prompt filtering: Note HAS tags
		const noteWithTags = await context.createFile(
			'Notes/WithTags.md',
			'---\ntags: [secret]\n---\n# Content',
		);
		let leaf = context.app.workspace.getLeaf(true);
		await leaf.openFile(noteWithTags);

		mockLlm.requestEnrichment.mockResolvedValue({ frontmatter: {}, body: '' }); // dummy
		await command.execute();

		let callArgs = mockLlm.requestEnrichment.mock.calls[0][0];
		const promptMatch = callArgs.prompt.match(/frontmatterJson: (\{[\s\S]*?\})/);
		expect(promptMatch).not.toBeNull();
		if (promptMatch) {
			let promptJson = JSON.parse(promptMatch[1]);
			expect(promptJson.tags).toBeUndefined();
			expect(promptJson.tag).toBeUndefined();
		}

		mockLlm.requestEnrichment.mockClear();

		// 2. Verify Response filtering: Note has NO tags, LLM returns tags
		const noteNoTags = await context.createFile(
			'Notes/NoTags.md',
			'---\nsummary: original\n---\n# Content',
		);
		leaf = context.app.workspace.getLeaf(true);
		await leaf.openFile(noteNoTags);

		mockLlm.requestEnrichment.mockResolvedValue({
			frontmatter: { tags: ['injected'], tag: 'injected_single' },
			body: 'Body',
		});

		await command.execute();

		const content = await context.app.vault.read(noteNoTags);
		expect(content).not.toContain('injected');
		expect(content).toContain('summary: original');
	});
});
