export interface TranslationService {
    t(key: string, args?: Record<string, any>): string;
}
