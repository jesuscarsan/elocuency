import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ApplyTemplateUseCase } from './ApplyTemplateUseCase';
import { NoteMother } from '../../__test-utils__/Mothers/NoteMother';
import {
	createMockNoteRepositoryPort,
	createMockTemplateRepositoryPort,
	createMockUIServicePort,
	createMockLlmPort,
	createMockImageServicePort,
	createMockCommandExecutorPort,
	createMockNetworkPort,
	createMockTranslationService,
} from '../../__test-utils__/mockFactories';
import { FrontmatterKeys } from '@elo/core';

describe('ApplyTemplateUseCase', () => {
	let useCase: ApplyTemplateUseCase;
	let noteRepository: any;
	let templateRepository: any;
	let uiService: any;
	let llm: any;
	let imageService: any;
	let commandExecutor: any;
	let personasOrganizer: any;
	let networkPort: any;
	let translationService: any;

	beforeEach(() => {
		noteRepository = createMockNoteRepositoryPort();
		templateRepository = createMockTemplateRepositoryPort();
		uiService = createMockUIServicePort();
		llm = createMockLlmPort();
		imageService = createMockImageServicePort();
		commandExecutor = createMockCommandExecutorPort();
		networkPort = createMockNetworkPort();
		translationService = createMockTranslationService();

		personasOrganizer = { organize: vi.fn() };

		useCase = new ApplyTemplateUseCase(
			noteRepository,
			templateRepository,
			uiService,
			llm,
			imageService,
			commandExecutor,
			personasOrganizer as any,
			networkPort,
			translationService,
		);
	});

	it('should show message if target note does not exist', async () => {
		noteRepository.getNote.mockResolvedValue(null);
		await useCase.execute('invalid/path.md');
		expect(uiService.showMessage).toHaveBeenCalledWith('apply.openNote');
	});

	it('should show message if no templates are found', async () => {
		const note = NoteMother.create();
		noteRepository.getNote.mockResolvedValue(note);
		templateRepository.getAllTemplates.mockResolvedValue([]);

		await useCase.execute(note.path);
		expect(uiService.showMessage).toHaveBeenCalledWith('apply.noTemplates');
	});

	it('should allow selecting template if multiple found', async () => {
		const note = NoteMother.create({ content: 'Note content' });
		noteRepository.getNote.mockResolvedValue(note);
		const templates = [
			{ template: { basename: 'T1', content: 'T1 content', config: { prompt: 'P' } } },
			{ template: { basename: 'T2', content: 'T2 content', config: { prompt: 'P' } } },
		];
		templateRepository.getAllTemplates.mockResolvedValue(templates);
		uiService.showSelectionModal.mockResolvedValue(templates[1]);
		llm.requestEnrichment.mockResolvedValue({ body: 'B' });

		await useCase.execute(note.path);
		expect(uiService.showSelectionModal).toHaveBeenCalledWith(
			'apply.selectTemplate',
			expect.any(Array),
			expect.any(Function),
		);
	});

	it('should show message if no template selected', async () => {
		const note = NoteMother.create();
		noteRepository.getNote.mockResolvedValue(note);
		const templates = [
			{ template: { basename: 'T1', content: 'T' } },
			{ template: { basename: 'T2', content: 'T' } },
		];
		templateRepository.getAllTemplates.mockResolvedValue(templates);
		uiService.showSelectionModal.mockResolvedValue(null);

		await useCase.execute(note.path);
		expect(uiService.showMessage).toHaveBeenCalledWith('apply.noTemplateSelected');
	});

	it('should apply template and save note', async () => {
		const note = NoteMother.create({ path: 'test.md', content: 'Original Body' });
		noteRepository.getNote.mockResolvedValue(note);
		templateRepository.getAllTemplates.mockResolvedValue([
			{
				template: { basename: 'T1', config: { prompt: 'P' }, content: 'T content' },
				score: 1,
			} as any,
		]);
		llm.requestEnrichment.mockResolvedValue({
			body: 'Enriched Body',
			frontmatter: { newKey: 'v' },
		});

		await useCase.execute(note.path);

		expect(uiService.showMessage).toHaveBeenCalledWith(expect.stringContaining('apply.applying'));
		expect(uiService.showMessage).toHaveBeenCalledWith(expect.stringContaining('template: T1'));
		expect(noteRepository.saveNote).toHaveBeenCalled();
	});

	it('should handle network error when fetching promptUrl', async () => {
		const note = NoteMother.create({ path: 'test.md', content: 'C' });
		noteRepository.getNote.mockResolvedValue(note);
		templateRepository.getAllTemplates.mockResolvedValue([
			{
				template: {
					basename: 'T1',
					config: { prompt: 'P', promptUrl: 'http://fail' },
					content: 'T',
				},
				score: 1,
			} as any,
		]);
		networkPort.getText.mockRejectedValue(new Error('fail'));
		llm.requestEnrichment.mockResolvedValue({ body: 'B' });

		await useCase.execute(note.path);
		expect(uiService.showMessage).toHaveBeenCalledWith(expect.stringContaining('apply.fetchError'));
	});

	it('should handle images if configured in template', async () => {
		const note = NoteMother.create({ path: 'test.md', content: 'C' });
		noteRepository.getNote.mockResolvedValue(note);
		templateRepository.getAllTemplates.mockResolvedValue([
			{
				template: {
					basename: 'T1',
					config: { prompt: 'P', images: { count: 1, query: 'Q' } },
					content: '---\n' + FrontmatterKeys.EloImages + ': []\n---\nBody',
				},
				score: 1,
			} as any,
		]);
		llm.requestEnrichment.mockResolvedValue({
			body: 'B',
			frontmatter: { [FrontmatterKeys.EloImages]: [] },
		});
		imageService.searchImages.mockResolvedValue(['http://img.com']);

		await useCase.execute(note.path);

		expect(imageService.searchImages).toHaveBeenCalled();
		expect(noteRepository.saveNote).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining('http://img.com') }),
		);
	});

	it('should execute commands if configured', async () => {
		const note = NoteMother.create({ path: 'test.md', content: 'C' });
		noteRepository.getNote.mockResolvedValue(note);
		templateRepository.getAllTemplates.mockResolvedValue([
			{
				template: { basename: 'T1', config: { prompt: 'P', commands: ['cmd1'] }, content: 'T' },
				score: 1,
			} as any,
		]);
		llm.requestEnrichment.mockResolvedValue({ body: 'B' });

		await useCase.execute(note.path);
		expect(commandExecutor.executeCommand).toHaveBeenCalledWith('cmd1');
	});

	it('should test config.path branch', async () => {
		const note = NoteMother.create({ path: 'test.md', content: 'C' });
		noteRepository.getNote.mockResolvedValue(note);
		templateRepository.getAllTemplates.mockResolvedValue([
			{
				template: { basename: 'T1', config: { prompt: 'P', path: 'new/path.md' }, content: 'T' },
				score: 1,
			} as any,
		]);
		llm.requestEnrichment.mockResolvedValue({ body: 'B' });

		await useCase.execute(note.path);
		expect(noteRepository.renameNote).toHaveBeenCalledWith(note.path, 'new/path.md');
	});

	it('should handle image search failure', async () => {
		const note = NoteMother.create({ path: 'test.md', content: 'C' });
		noteRepository.getNote.mockResolvedValue(note);
		templateRepository.getAllTemplates.mockResolvedValue([
			{
				template: {
					basename: 'T1',
					config: { prompt: 'P' },
					content: '---\n' + FrontmatterKeys.EloImages + ': []\n---\nBody',
				},
				score: 1,
			} as any,
		]);
		llm.requestEnrichment.mockResolvedValue({
			body: 'B',
			frontmatter: { [FrontmatterKeys.EloImages]: [] },
		});
		imageService.searchImages.mockRejectedValue(new Error('Search failed'));

		await useCase.execute(note.path);
		// Should not crash
		expect(noteRepository.saveNote).toHaveBeenCalled();
	});
});
