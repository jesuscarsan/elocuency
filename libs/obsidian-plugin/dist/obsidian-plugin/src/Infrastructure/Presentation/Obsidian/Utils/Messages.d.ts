import { TranslationService } from '../../../../Domain/Interfaces/TranslationService';
/**
 * Utility to show a notice in Obsidian and log it to the console.
 * Replacement for 'new Notice' to allow for better traceability.
 */
export declare function showMessage(keyOrMessage: string, args?: Record<string, any>, translationService?: TranslationService): void;
