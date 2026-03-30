import { NetworkPort } from '../../Domain/Ports/NetworkPort';
import { UIServicePort, CommandExecutorPort, TranslationService } from '@elo/obsidian-plugin';
import { TemplateMatch } from '../../Domain/Ports/TemplateRepositoryPort';

export class ApplyTemplateUseCase {
	private readonly authHeaders: Record<string, string>;

	constructor(
		private readonly serverUrl: string,
		private readonly networkPort: NetworkPort,
		private readonly uiService: UIServicePort,
		private readonly commandExecutor: CommandExecutorPort,
		private readonly translationService: TranslationService,
		authToken: string = '',
	) {
		this.authHeaders = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
	}

	async execute(targetNotePath: string, promptUrl?: string) {
		console.log('[ApplyTemplateUseCase] Start execution via elo-server API');

		this.uiService.showMessage('apply.applying', { template: '...' });

		const response = await this.networkPort.postJson<any>(
			`${this.serverUrl}/api/templates/apply`,
			{ targetNotePath, promptUrl },
			this.authHeaders
		);

		if (response?.status === 'needs_selection') {
			const matches = response.matches;
			if (!matches || matches.length === 0) {
				this.uiService.showMessage('apply.noTemplates');
				return;
			}
			const selected = await this.uiService.showSelectionModal(
				this.translationService.t('apply.selectTemplate'),
				matches,
				(m: any) => m.template || m.description || 'Template'
			);

			if (!selected) {
				this.uiService.showMessage('apply.noTemplateSelected');
				return;
			}

			const secondResponse = await this.networkPort.postJson<any>(
				`${this.serverUrl}/api/templates/apply`,
				{ targetNotePath, promptUrl, templateId: selected.template },
				this.authHeaders
			);

			await this.processSuccessResponse(targetNotePath, secondResponse);
		} else {
			await this.processSuccessResponse(targetNotePath, response);
		}
	}

	async applyTemplate(
		notePath: string,
		templateMatch: TemplateMatch,
		predefinedPromptUrl?: string,
	) {
		let templateId = templateMatch.template.path.replace('!!config/templates/', '');
		if (templateId.startsWith('/')) templateId = templateId.slice(1);

		const requestData = {
			targetNotePath: notePath,
			templateId: templateId,
			promptUrl: predefinedPromptUrl
		};

		const response = await this.networkPort.postJson<any>(
			`${this.serverUrl}/api/templates/apply`,
			requestData,
			this.authHeaders
		);

		await this.processSuccessResponse(notePath, response);
	}

	private async processSuccessResponse(originalNotePath: string, response: any) {
		if (response?.status === 'error') {
			this.uiService.showMessage('apply.serverError', { error: response.message });
			return;
		}

		if (response?.notePath && response.notePath !== originalNotePath) {
			console.log(`[ApplyTemplateUseCase] Server relocated note from ${originalNotePath} to ${response.notePath}`);
			await this.uiService.openFile(response.notePath);
		}

		if (response?.commands && Array.isArray(response.commands)) {
			for (const cmdId of response.commands) {
				const success = await this.commandExecutor.executeCommand(cmdId);
				if (!success) {
					this.uiService.showMessage('apply.invalidCommand', { command: cmdId });
				}
			}
		}

		// Let obsidian sync catch up.
	}
}
