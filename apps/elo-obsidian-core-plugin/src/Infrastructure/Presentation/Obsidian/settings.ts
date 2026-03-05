export type LocationStrategy = 'same-folder' | 'fixed-folder';

export interface UnresolvedLinkGeneratorSettings {
	locationStrategy: LocationStrategy;
	targetFolder: string;
	locationsFolder: string;
	missingNotesTemplatePath: string;
	hideEmptyProperties: boolean;
	userLanguage: string;
	toLearnLanguage: string;
	eloServerUrl: string;
	eloServerToken: string;
}

export const DEFAULT_SETTINGS: UnresolvedLinkGeneratorSettings = {
	locationStrategy: 'same-folder',
	targetFolder: '',
	locationsFolder: 'Mi mundo',
	missingNotesTemplatePath: '# {{title}}\n',
	hideEmptyProperties: false,
	userLanguage: 'es',
	toLearnLanguage: 'en',
	eloServerUrl: 'http://localhost:8001',
	eloServerToken: '',
};
