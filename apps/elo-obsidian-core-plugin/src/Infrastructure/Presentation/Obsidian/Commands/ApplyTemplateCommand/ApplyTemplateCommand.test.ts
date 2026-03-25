import { App, TFile, TFolder, Modal, requestUrl } from 'obsidian';
import { ApplyTemplateCommand } from './ApplyTemplateCommand';
import { TestContext } from '@/__test-utils__/TestContext';
import { ImageEnricherService } from '@/Application/Services/ImageEnricherService';
import { UnresolvedLinkGeneratorSettings } from '@/Infrastructure/Presentation/Obsidian/settings';
import { createMockTranslationService } from '@/__test-utils__/mockFactories';

jest.mock('obsidian', () => ({
	...jest.requireActual('obsidian'),
	requestUrl: jest.fn(),
}));

describe('ApplyTemplateCommand', () => {
	let context: TestContext;
	let command: ApplyTemplateCommand;
	let mockImageEnricher: jest.Mocked<ImageEnricherService>;
	let settings: UnresolvedLinkGeneratorSettings;
	let translationService: any;

	beforeEach(() => {
		context = new TestContext();
		translationService = createMockTranslationService();

		mockImageEnricher = {
			searchImages: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<ImageEnricherService>;

		settings = { eloServerUrl: 'http://localhost:8001' } as any;

		command = new ApplyTemplateCommand(
			{} as any, // obsolete llm
			mockImageEnricher,
			context.app as any,
			settings,
			translationService,
		);
		
		(requestUrl as jest.Mock).mockClear();
		(requestUrl as jest.Mock).mockResolvedValue({
			json: { status: 'success', notePath: 'Notes/My Note.md' }
		});
	});

	test('should send a request to the server API to apply the template', async () => {
		await context.createFolder('Notes');
		const targetFile = await context.createFile('Notes/My Note.md', '# Original Content');

		const leaf = context.app.workspace.getLeaf(true);
		await leaf.openFile(targetFile);

		await command.execute();

		expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
			url: 'http://localhost:8001/api/templates/apply',
			method: 'POST',
			body: JSON.stringify({ targetNotePath: 'Notes/My Note.md' })
		}));
	});
});
