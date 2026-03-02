import { Notice } from 'obsidian';
import { TranslationService } from '@elo/obsidian-plugin';

export function showMessage(
	keyOrMessage: string,
	args?: Record<string, any>,
	translationService?: TranslationService,
) {
	const message = translationService ? translationService.t(keyOrMessage, args) : keyOrMessage;
	console.log('Msg:', message);
	new Notice(message, 5000);
}
