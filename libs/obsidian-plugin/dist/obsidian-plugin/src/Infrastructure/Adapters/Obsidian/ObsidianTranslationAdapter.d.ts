import { TranslationService } from '../../../Domain/Interfaces/TranslationService';
declare global {
    interface Window {
        moment: any;
    }
}
export declare class ObsidianTranslationAdapter implements TranslationService {
    private locale;
    private resources;
    constructor(resources: Record<string, Record<string, string>>);
    t(key: string, args?: Record<string, any>): string;
}
