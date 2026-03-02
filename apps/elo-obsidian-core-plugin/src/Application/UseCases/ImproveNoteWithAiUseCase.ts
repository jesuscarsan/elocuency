import { LlmPort, FrontmatterKeys, FrontmatterRegistry } from '@elo/core';
import { EditorPort } from '@elo/obsidian-plugin';
import { TranslationService } from '@elo/obsidian-plugin';
import {
	formatFrontmatterBlock,
	applyFrontmatterUpdates,
	parseFrontmatter,
	splitFrontmatter,
} from '@/Domain/Utils/FrontmatterUtils';
import { TemplateContext } from '../../Infrastructure/Presentation/Obsidian/Utils/TemplateContext';

export class ImproveNoteWithAiUseCase {
	constructor(
		private readonly llm: LlmPort,
		private readonly editor: EditorPort,
		private readonly translationService: TranslationService,
	) {}

	async execute(
		showMessage: (keyOrMessage: string, args?: Record<string, any>) => void = (m) =>
			console.log('Msg:', m),
	) {
		console.log('[ImproveNoteWithAiUseCase] Start');

		const content = this.editor.getValue();
		const split = splitFrontmatter(content);
		const frontmatter = parseFrontmatter(split.frontmatterText) || {};

		const customPrompt = frontmatter[FrontmatterKeys.EloPrompt];
		const customCommands = frontmatter[FrontmatterKeys.EloCommands];

		let promptToUse = '';
		let includeFrontmatter = false;

		// 0. Use context from ApplyTemplateCommand if available
		const contextConfig = TemplateContext.activeConfig;
		if (contextConfig && contextConfig.prompt) {
			promptToUse = contextConfig.prompt;
			includeFrontmatter = !!contextConfig.hasFrontmatter;
		}

		// 2. Fallback to custom prompt
		if (!promptToUse && customPrompt) {
			promptToUse = customPrompt as string;
			const cleanKeys = Object.keys(frontmatter).filter((k) => !k.startsWith('!!'));
			includeFrontmatter = cleanKeys.length > 0;
		}

		if (!promptToUse) {
			showMessage('enhance.noPromptConfigured');
			return;
		}

		showMessage('enhance.enhancing');

		const title = this.editor.getNoteTitle();

		// Filter out internal keys for the prompt context
		const frontmatterForContext = { ...frontmatter };
		delete frontmatterForContext[FrontmatterKeys.EloPrompt];
		delete frontmatterForContext[FrontmatterKeys.EloCommands];

		const prompt = this.buildPrompt(
			title,
			promptToUse as string,
			frontmatterForContext,
			split.body,
			includeFrontmatter,
			customCommands as string | string[],
		);

		const response = await this.llm.requestEnrichment({ prompt });

		if (response) {
			const frontmatterToProcess = response.frontmatter || {};
			const processedFrontmatter = this.processAiResponseFrontmatter(frontmatterToProcess);
			const updatedFrontmatter = applyFrontmatterUpdates(frontmatter, processedFrontmatter);

			const frontmatterBlock = updatedFrontmatter ? formatFrontmatterBlock(updatedFrontmatter) : '';

			const newContent = [frontmatterBlock, split.body, response.body].filter(Boolean).join('\n\n');

			this.editor.setValue(newContent);
			showMessage('enhance.enhanced');
		} else {
			showMessage('enhance.failed');
		}
	}

	private buildPrompt(
		title: string,
		settingPrompt: string,
		frontmatter: any,
		body: string,
		includeFrontmatter: boolean,
		customCommands?: string | string[],
	): string {
		const t = (key: string, args?: any) => this.translationService.t(key, args);

		const parts = [t('enhance.promptNote', { title }), `${settingPrompt}`];

		if (customCommands) {
			if (Array.isArray(customCommands)) {
				parts.push(...customCommands);
			} else {
				parts.push(customCommands);
			}
		}

		parts.push(
			t('enhance.promptFrontmatter', { json: JSON.stringify(frontmatter) }),
			t('enhance.promptBody', { body }),
			t('enhance.promptReturnJson'),
			t('enhance.promptReturnBody'),
		);

		if (includeFrontmatter) {
			parts.push(t('enhance.promptReturnFrontmatter'));
		}

		parts.push(t('enhance.promptInvalidChars'));

		return parts.join('\n');
	}

	private processAiResponseFrontmatter(
		frontmatter: Record<string, unknown>,
	): Record<string, unknown> {
		if (!frontmatter) return frontmatter;

		const processed: Record<string, unknown> = {};
		const keyMap = new Map<string, string>();

		// Map lowercase keys to canonical keys from Registry
		Object.keys(FrontmatterRegistry).forEach((key) => {
			keyMap.set(key.toLowerCase(), key);
		});

		for (const [key, value] of Object.entries(frontmatter)) {
			let targetKey = key;
			const lowerKey = key.toLowerCase();

			// Try to find canonical key
			if (keyMap.has(lowerKey)) {
				targetKey = keyMap.get(lowerKey)!;
			}

			const config = FrontmatterRegistry[targetKey];
			let finalValue = value;

			if (config && config.asLink) {
				if (typeof value === 'string') {
					finalValue = this.ensureBrackets(value);
				} else if (Array.isArray(value)) {
					finalValue = value.map((item) => {
						if (typeof item === 'string') {
							return this.ensureBrackets(item);
						}
						return item;
					});
				}
			}

			processed[targetKey] = finalValue;
		}

		return processed;
	}

	private ensureBrackets(value: string): string {
		const trimmed = value.trim();
		if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
			return trimmed;
		}
		return `[[${trimmed}]]`;
	}
}
