import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImproveNoteWithAiUseCase } from './ImproveNoteWithAiUseCase';
import {
	createMockEditorPort,
	createMockLlmPort,
	createMockTranslationService,
} from '../../__test-utils__/mockFactories';
import { TemplateContext } from '../../Infrastructure/Presentation/Obsidian/Utils/TemplateContext';

describe('ImproveNoteWithAiUseCase', () => {
	let useCase: ImproveNoteWithAiUseCase;
	let editor: any;
	let llm: any;
	let showMessage: any;
	let translationService: any;

	beforeEach(() => {
		editor = createMockEditorPort();
		llm = createMockLlmPort();
		translationService = createMockTranslationService();
		showMessage = vi.fn();
		useCase = new ImproveNoteWithAiUseCase(llm, editor, translationService);
		TemplateContext.activeConfig = null;
	});

	it('should show message if no prompt is configured', async () => {
		editor.getValue.mockReturnValue('Some content without prompt');

		await useCase.execute(showMessage);

		expect(showMessage).toHaveBeenCalledWith('enhance.noPromptConfigured');
	});

	it('should enhance note when prompt is present in frontmatter', async () => {
		const content = `---\n"!!prompt": Make it poetic\n---\nOriginal body`;
		editor.getValue.mockReturnValue(content);
		editor.getNoteTitle.mockReturnValue('Test Note');
		llm.requestEnrichment.mockResolvedValue({
			body: 'Poetic body',
			frontmatter: { poems: 1 },
		});

		await useCase.execute(showMessage);

		expect(showMessage).toHaveBeenCalledWith('enhance.enhancing');
		expect(llm.requestEnrichment).toHaveBeenCalled();
		expect(editor.setValue).toHaveBeenCalledWith(expect.stringContaining('Poetic body'));
		expect(editor.setValue).toHaveBeenCalledWith(expect.stringContaining('poems: 1'));
		expect(showMessage).toHaveBeenCalledWith('enhance.enhanced');
	});

	it('should use prompt from TemplateContext if available', async () => {
		TemplateContext.activeConfig = { prompt: 'Context Prompt' } as any;
		editor.getValue.mockReturnValue('Body');
		editor.getNoteTitle.mockReturnValue('Title');
		llm.requestEnrichment.mockResolvedValue({ body: 'Ensured' });

		await useCase.execute(showMessage);

		expect(llm.requestEnrichment).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: expect.stringContaining('Context Prompt'),
			}),
		);
	});

	it('should handle customCommands as array', async () => {
		const content = `---\n"!!prompt": P\n"!!commands": ["cmd1", "cmd2"]\n---\nBody`;
		editor.getValue.mockReturnValue(content);
		llm.requestEnrichment.mockResolvedValue({ body: 'B' });

		await useCase.execute(showMessage);

		expect(llm.requestEnrichment).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: expect.stringContaining('cmd1'),
			}),
		);
	});

	it('should handle customCommands as string', async () => {
		const content = `---\n"!!prompt": P\n"!!commands": "cmd1"\n---\nBody`;
		editor.getValue.mockReturnValue(content);
		llm.requestEnrichment.mockResolvedValue({ body: 'B' });

		await useCase.execute(showMessage);

		expect(llm.requestEnrichment).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: expect.stringContaining('cmd1'),
			}),
		);
	});

	it('should handle array of strings in frontmatter with asLink', async () => {
		const content = `---\n"!!prompt": P\n---\nB`;
		editor.getValue.mockReturnValue(content);
		llm.requestEnrichment.mockResolvedValue({
			body: 'B',
			frontmatter: { Países: ['Francia', '[[Alemania]]', 123] },
		});

		await useCase.execute(showMessage);

		expect(editor.setValue).toHaveBeenCalledWith(expect.stringContaining('[[Francia]]'));
		expect(editor.setValue).toHaveBeenCalledWith(expect.stringContaining('[[Alemania]]'));
	});

	it('should handle single string in frontmatter with asLink', async () => {
		const content = `---\n"!!prompt": P\n---\nB`;
		editor.getValue.mockReturnValue(content);
		llm.requestEnrichment.mockResolvedValue({
			body: 'B',
			frontmatter: { Países: 'Francia' },
		});

		await useCase.execute(showMessage);

		expect(editor.setValue).toHaveBeenCalledWith(expect.stringContaining('[[Francia]]'));
	});

	it('should handle empty frontmatter in response', async () => {
		const content = `---\n"!!prompt": test\n---\nbody`;
		editor.getValue.mockReturnValue(content);
		llm.requestEnrichment.mockResolvedValue({
			body: 'New body',
			frontmatter: null as any,
		});

		await useCase.execute(showMessage);

		expect(editor.setValue).toHaveBeenCalledWith(expect.stringContaining('New body'));
	});

	it('should show failure message if AI enrichment fails', async () => {
		editor.getValue.mockReturnValue('---\n"!!prompt": test\n---\nbody');
		llm.requestEnrichment.mockResolvedValue(null);

		await useCase.execute(showMessage);

		expect(showMessage).toHaveBeenCalledWith('enhance.failed');
	});
});
