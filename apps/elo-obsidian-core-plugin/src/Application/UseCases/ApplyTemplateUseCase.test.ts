import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ApplyTemplateUseCase } from './ApplyTemplateUseCase';
import {
	createMockUIServicePort,
	createMockCommandExecutorPort,
	createMockNetworkPort,
	createMockTranslationService,
} from '../../__test-utils__/mockFactories';

describe('ApplyTemplateUseCase', () => {
	let useCase: ApplyTemplateUseCase;
	let networkPort: any;
	let uiService: any;
	let commandExecutor: any;
	let translationService: any;
	const serverUrl = 'http://localhost:8001';

	beforeEach(() => {
		networkPort = createMockNetworkPort();
		uiService = createMockUIServicePort();
		commandExecutor = createMockCommandExecutorPort();
		translationService = createMockTranslationService();

		useCase = new ApplyTemplateUseCase(
			serverUrl,
			networkPort,
			uiService,
			commandExecutor,
			translationService,
		);
	});

	it('should show error message if server returns error status', async () => {
		networkPort.postJson.mockResolvedValue({ status: 'error', message: 'Test error' });
		await useCase.execute('test.md');
		expect(uiService.showMessage).toHaveBeenCalledWith('apply.serverError', { error: 'Test error' });
	});

	it('should ask user to select template if multiple match', async () => {
		const matches = [
			{ template: 'T1', description: 'Template 1' },
			{ template: 'T2', description: 'Template 2' }
		];
		networkPort.postJson.mockResolvedValueOnce({ status: 'needs_selection', matches });
		uiService.showSelectionModal.mockResolvedValue(matches[0]);
		networkPort.postJson.mockResolvedValueOnce({ status: 'success', notePath: 'test.md' });

		await useCase.execute('test.md');

		expect(uiService.showSelectionModal).toHaveBeenCalled();
		expect(networkPort.postJson).toHaveBeenCalledTimes(2);
		expect(networkPort.postJson).toHaveBeenNthCalledWith(2, `${serverUrl}/api/templates/apply`, {
			targetNotePath: 'test.md',
			promptUrl: undefined,
			templateId: 'T1'
		}, {});
	});

	it('should execute commands returned from success response', async () => {
		networkPort.postJson.mockResolvedValue({
			status: 'success',
			notePath: 'test.md',
			commands: ['cmd1', 'cmd2']
		});
		commandExecutor.executeCommand.mockResolvedValue(true);

		await useCase.execute('test.md');

		expect(commandExecutor.executeCommand).toHaveBeenCalledTimes(2);
		expect(commandExecutor.executeCommand).toHaveBeenCalledWith('cmd1');
		expect(commandExecutor.executeCommand).toHaveBeenCalledWith('cmd2');
	});

	it('should apply pre-selected template directly', async () => {
		networkPort.postJson.mockResolvedValue({ status: 'success', notePath: 'test.md' });

		const mockMatch = {
			template: { path: '!!config/templates/T1', basename: 'T1', content: '', config: {} },
			score: 1
		};

		await useCase.applyTemplate('test.md', mockMatch);

		expect(networkPort.postJson).toHaveBeenCalledWith(`${serverUrl}/api/templates/apply`, {
			targetNotePath: 'test.md',
			promptUrl: undefined,
			templateId: 'T1'
		}, {});
	});
});
