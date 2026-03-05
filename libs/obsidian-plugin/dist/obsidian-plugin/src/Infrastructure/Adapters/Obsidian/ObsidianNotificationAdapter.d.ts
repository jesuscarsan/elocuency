import { NotificationPort } from '../../../Domain/Ports/NotificationPort';
import { TranslationService } from '../../../Domain/Interfaces/TranslationService';
export declare class ObsidianNotificationAdapter implements NotificationPort {
    private readonly translationService?;
    constructor(translationService?: TranslationService | undefined);
    showMessage(keyOrMessage: string, args?: Record<string, any>): void;
    showError(keyOrMessage: string, args?: Record<string, any>): void;
}
