"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObsidianTranslationAdapter = void 0;
class ObsidianTranslationAdapter {
    constructor(resources) {
        this.resources = resources;
        this.locale = window.moment ? window.moment.locale() : 'en';
    }
    t(key, args) {
        const localeResources = this.resources[this.locale] || this.resources['en'] || {};
        let translation = localeResources[key];
        if (!translation) {
            // Fallback to English if not found in current locale
            const fallbackResources = this.resources['en'] || {};
            translation = fallbackResources[key] || key;
        }
        if (args) {
            Object.keys(args).forEach(argKey => {
                translation = translation.replace(`{${argKey}}`, args[argKey]);
            });
        }
        return translation;
    }
}
exports.ObsidianTranslationAdapter = ObsidianTranslationAdapter;
