"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObsidianRoleRepository = void 0;
const obsidian_1 = require("obsidian");
class ObsidianRoleRepository {
    constructor(app, settings) {
        this.app = app;
        this.settings = settings;
    }
    async loadRoles() {
        const folderPath = 'Personas';
        if (!folderPath)
            return [];
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder || !(folder instanceof obsidian_1.TFolder)) {
            return [];
        }
        const roles = [];
        for (const child of folder.children) {
            if (child instanceof obsidian_1.TFile && child.extension === 'md') {
                const cache = this.app.metadataCache.getFileCache(child);
                const prompt = cache?.frontmatter?.['!!prompt'];
                const evaluationPrompt = cache?.frontmatter?.['!!evaluationPrompt'];
                const trackLevelRaw = cache?.frontmatter?.['!!trackLevelAnswer'];
                const trackLevel = trackLevelRaw === true || trackLevelRaw === 'true';
                // Read new params
                const liveVoice = cache?.frontmatter?.['!!liveVoice'];
                const liveTemperature = cache?.frontmatter?.['!!liveTemperature'];
                const vocabularyList = cache?.frontmatter?.['!!vocabularyList'];
                if (prompt && typeof prompt === 'string') {
                    roles.push({
                        name: child.basename,
                        prompt: prompt,
                        trackLevelAnswer: trackLevel,
                        evaluationPrompt: typeof evaluationPrompt === 'string' ? evaluationPrompt : undefined,
                        liveVoice: typeof liveVoice === 'string' ? liveVoice : undefined,
                        liveTemperature: typeof liveTemperature === 'number' ? liveTemperature : undefined,
                        vocabularyList: Array.isArray(vocabularyList) ? vocabularyList : undefined
                    });
                }
            }
        }
        return roles;
    }
}
exports.ObsidianRoleRepository = ObsidianRoleRepository;
