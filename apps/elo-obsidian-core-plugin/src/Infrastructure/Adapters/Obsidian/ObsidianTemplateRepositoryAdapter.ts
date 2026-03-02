import { App, TFile } from 'obsidian';
import {
	TemplateRepositoryPort,
	TemplateMatch,
} from '../../../Domain/Ports/TemplateRepositoryPort';
import { Template } from '../../../Domain/Ports/TemplateRepositoryPort';
import { getAllTemplateConfigs } from '../../Presentation/Obsidian/Utils/TemplateConfig';

export class ObsidianTemplateRepositoryAdapter implements TemplateRepositoryPort {
	constructor(private readonly app: App) {}

	async getAllTemplates(): Promise<TemplateMatch[]> {
		const matches = await getAllTemplateConfigs(this.app);

		return matches.map((m) => ({
			template: {
				path: m.templateFile.path,
				basename: m.templateFile.basename,
				content: m.cleanedContent,
				config: m.config,
			} as Template,
			score: 0,
		}));
	}
}
