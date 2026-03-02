export type LocationStrategy = 'same-folder' | 'fixed-folder';

export interface UnresolvedLinkGeneratorSettings {
	locationStrategy: LocationStrategy;
	targetFolder: string;
	missingNotesTemplatePath: string;
	geminiApiKey: string;
	googleCustomSearchApiKey: string;
	googleCustomSearchEngineId: string;
	hideEmptyProperties: boolean;
	userLanguage: string;
	toLearnLanguage: string;
	geminiRolesFolder: string;
}

export const DEFAULT_SETTINGS: UnresolvedLinkGeneratorSettings = {
	locationStrategy: 'same-folder',
	targetFolder: '',
	missingNotesTemplatePath: '# {{title}}\n',
	geminiApiKey: '',
	googleCustomSearchApiKey: '',
	googleCustomSearchEngineId: '',
	hideEmptyProperties: false,
	userLanguage: 'es',
	toLearnLanguage: 'en',
	geminiRolesFolder: 'Personas',
};
