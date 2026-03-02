import { App, TFile, MarkdownView } from 'obsidian';
import { EnhanceByAiCommand } from './EnhanceByAiCommand';
import { TemplateContext } from '@/Infrastructure/Presentation/Obsidian/Utils/TemplateContext';
import { TestContext } from '@/__test-utils__/TestContext';
import { LlmPort } from '@elo/core';
import { FrontmatterKeys } from '@elo/core';
import { createMockTranslationService } from '@/__test-utils__/mockFactories';

describe('EnhanceByAiCommand', () => {
	let context: TestContext;
	// ... (skip lines) ...

	let command: EnhanceByAiCommand;
	let mockLlm: jest.Mocked<LlmPort>;
	let settings: any;
	let translationService: any;

	beforeEach(() => {
		context = new TestContext();
		translationService = createMockTranslationService();

		mockLlm = {
			requestEnrichment: jest.fn(),
			requestStreamBrief: jest.fn(),
			request: jest.fn(),
			requestJson: jest.fn(),
		} as unknown as jest.Mocked<LlmPort>;

		settings = {};

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

		command = new EnhanceByAiCommand(context.app as any, settings, mockLlm, translationService);
	});

	test('should enhance note using frontmatter prompt', async () => {
		// Setup
		await context.createFolder('Notes');
		const file = await context.createFile(
			'Notes/My Note.md',
			'---\n"!!prompt": Custom Prompt\n---\n# Content',
		);

		// Setup active leaf
		context.app.workspace.getLeaf(true);
		const leaf = (context.app.workspace as any).activeLeaf;
		leaf.view = new MarkdownView(file as any);

		// Mock LLM response
		mockLlm.requestEnrichment.mockResolvedValue({
			frontmatter: { summary: 'New Summary' },
			body: 'Enhanced Content',
		});

		await command.execute();

		const updatedContent = await context.app.vault.read(file);

		// Verify Content
		expect(updatedContent).toContain('summary: New Summary');
		expect(updatedContent).toContain('Enhanced Content');
		expect(updatedContent).toContain('# Content');
	});

	test('should prioritize TemplateContext usage (from ApplyTemplateCommand)', async () => {
		// Setup Template
		TemplateContext.activeConfig = {
			prompt: 'Context Prompt',
			commands: ['EnhanceByAiCommand'],
		};

		await context.createFolder('Templates');
		await context.createFile(
			'Templates/Folder Template.md',
			'---\n"!!prompt": Folder Prompt\n---\n# Template',
		);

		await context.createFolder('Notes');
		const file = await context.createFile(
			'Notes/My Note.md',
			'---\n"!!prompt": Local Prompt\n---\n# Content',
		);

		context.app.workspace.getLeaf(true);
		const leaf = (context.app.workspace as any).activeLeaf;
		leaf.view = new MarkdownView(file as any);

		// Mock LLM
		mockLlm.requestEnrichment.mockResolvedValue({
			frontmatter: { tags: ['enhanced'] },
			body: 'Context Enhanced',
		});

		try {
			await command.execute();
		} finally {
			TemplateContext.activeConfig = null;
		}

		// Verify LLM called with Context Prompt
		const callArgs = mockLlm.requestEnrichment.mock.calls[0][0];
		expect(callArgs.prompt).toContain('Context Prompt');
		// It should NOT use prompts from file or template
		expect(callArgs.prompt).not.toContain('Local Prompt');

		const updatedContent = await context.app.vault.read(file);
		expect(updatedContent).toContain('Context Enhanced');
	});

	test('should request frontmatter if template context (from ApplyTemplateCommand) asks for it', async () => {
		// This is a new test case to replace the removed one, ensuring context logic works
		TemplateContext.activeConfig = {
			prompt: 'Context Prompt',
			hasFrontmatter: true,
		};

		await context.createFolder('Notes');
		const file = await context.createFile('Notes/Context Note.md', '# Content');

		context.app.workspace.getLeaf(true);
		const leaf = (context.app.workspace as any).activeLeaf;
		leaf.view = new MarkdownView(file as any);

		mockLlm.requestEnrichment.mockResolvedValue({
			body: 'Enhanced',
		});

		try {
			await command.execute();
		} finally {
			TemplateContext.activeConfig = null;
		}

		const callArgs = mockLlm.requestEnrichment.mock.calls[0][0];
		expect(callArgs.prompt).toContain('enhance.promptReturnJson');
	});
});
