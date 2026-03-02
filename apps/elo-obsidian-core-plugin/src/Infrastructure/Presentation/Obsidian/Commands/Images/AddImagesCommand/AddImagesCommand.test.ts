import { App, TFile, MarkdownView } from 'obsidian';
import { AddImagesCommand } from './AddImagesCommand';
import { TestContext } from '@/__test-utils__/TestContext';
import { ImageEnricherService } from '@/Application/Services/ImageEnricherService';
import { FrontmatterKeys } from '@elo/core';
import { createMockTranslationService } from '@/__test-utils__/mockFactories';

describe('AddImagesCommand', () => {
	let context: TestContext;
	let command: AddImagesCommand;
	let mockImageEnricher: jest.Mocked<ImageEnricherService>;
	let translationService: any;

	beforeEach(() => {
		context = new TestContext();
		translationService = createMockTranslationService();

		mockImageEnricher = {
			searchImages: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<ImageEnricherService>;

		command = new AddImagesCommand(context.app as any, mockImageEnricher, translationService);
	});

	test('should add found images to frontmatter', async () => {
		// Setup
		await context.createFolder('Notes');
		const file = await context.createFile('Notes/My Note.md', '---\ntags: [note]\n---\n# Content');

		// Setup View
		context.app.workspace.getLeaf(true);
		const leaf = (context.app.workspace as any).activeLeaf;
		leaf.view = new MarkdownView(file as any);

		// Mock Search Result
		const images = ['http://img1.jpg', 'http://img2.jpg'];
		mockImageEnricher.searchImages.mockResolvedValue(images);

		await command.execute();

		const updatedContent = await context.app.vault.read(file);
		// ""!!images"" key should be present
		expect(updatedContent).toContain(FrontmatterKeys.EloImages);
		expect(updatedContent).toContain('http://img1.jpg');
		expect(updatedContent).toContain('http://img2.jpg');
	});

	test('should not add images if already present', async () => {
		// Setup
		await context.createFolder('Notes');
		const file = await context.createFile(
			'Notes/My Note.md',
			`---\n"!!prompt": x\n"${FrontmatterKeys.EloImages}": ["existing.jpg"]\n---\n# Content`,
		);

		// Setup View
		context.app.workspace.getLeaf(true);
		const leaf = (context.app.workspace as any).activeLeaf;
		leaf.view = new MarkdownView(file as any);

		await command.execute();

		// Search should NOT be called
		expect(mockImageEnricher.searchImages).not.toHaveBeenCalled();

		const updatedContent = await context.app.vault.read(file);
		expect(updatedContent).toContain('existing.jpg');
	});
});
