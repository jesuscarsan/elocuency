import { App } from 'obsidian';
import { UIServicePort } from '../../../Domain/Ports/UIServicePort';
import { TranslationService } from '../../../Domain/Interfaces/TranslationService';
export declare class ObsidianUIServiceAdapter implements UIServicePort {
    private readonly app;
    private readonly translationService;
    constructor(app: App, translationService: TranslationService);
    showMessage(keyOrMessage: string, args?: Record<string, any>): void;
    showSelectionModal<T>(placeholder: string, items: T[], labelFn: (item: T) => string): Promise<T | null>;
}
