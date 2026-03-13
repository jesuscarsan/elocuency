import { TranslationService } from '../../../Domain/Interfaces/TranslationService';

declare global {
    interface Window {
        moment: any;
    }
}

export class ObsidianTranslationAdapter implements TranslationService {
    private locale: string;
    private resources: Record<string, Record<string, string>>;

    constructor(resources: Record<string, Record<string, string>>) {
        this.resources = resources;
        this.locale = window.moment ? window.moment.locale() : 'en';
    }

    t(key: string, args?: Record<string, any>): string {
        const localeResources = this.resources[this.locale] || this.resources['en'] || {};
        let translation = localeResources[key];

        if (!translation) {
            // Fallback to English if not found in current locale
            const fallbackResources = this.resources['en'] || {};
            translation = fallbackResources[key] || key;
        }

        if (args) {
            Object.keys(args).forEach(argKey => {
                const value = args[argKey] === undefined || args[argKey] === null ? '' : String(args[argKey]);
                translation = translation.split(`{{${argKey}}}`).join(value).split(`{${argKey}}`).join(value);
            });
        }

        return translation;
    }
}
