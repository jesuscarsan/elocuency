import { TFile, MarkdownView } from 'obsidian';
import { CommandEnum } from '@elo/core';

import { ApplyTemplateCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/ApplyTemplateCommand/ApplyTemplateCommand';
import { ApplyTemplateWithUrlCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/ApplyTemplateCommand/ApplyTemplateWithUrlCommand';
import { EnhanceByAiCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/AI/EnhanceByAiCommand/EnhanceByAiCommand';
import { EnrichWithPromptUrlCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/AI/EnrichWithPromptUrlCommand/EnrichWithPromptUrlCommand';
import { AddImagesCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Images/AddImagesCommand/AddImagesCommand';
import { CreateNoteFromImagesCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Images/CreateNoteFromImagesCommand/CreateNoteFromImagesCommand';
import { ApplyTemplateFromImageCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Images/ApplyTemplateFromImageCommand/ApplyTemplateFromImageCommand';
import { RelocateNoteByLinkFieldCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/RelocateNoteByLinkFieldCommand/RelocateNoteByLinkFieldCommand';
import { GenerateMissingNotesFromLinksCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Links/GenerateMissingNotesFromLinksCommand/GenerateMissingNotesFromLinksCommand';
import { CreateReciprocityLinksNotesCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Links/CreateReciprocityLinksNotesCommand/CreateReciprocityLinksNotesCommand';
import { AnalyzeAndLinkEntitiesCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Links/AnalyzeAndLinkEntitiesCommand/AnalyzeAndLinkEntitiesCommand';
import { GenerateMissingNotesFromListFieldCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Links/GenerateMissingNotesFromListFieldCommand/GenerateMissingNotesFromListFieldCommand';
import { InsertLinkToSelectedPhotoCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Photos/InsertLinkToSelectedPhotoCommand';
import { OpenLinkedPhotoCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Photos/OpenLinkedPhotoCommand';
import { NaturalLanguageSearchCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Search/NaturalLanguageSearchCommand';
import { TokenizeAndCreateDictionaryNotesCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/Dictionary/TokenizeAndCreateDictionaryNotesCommand';
import { ImportKeepTakeoutCommand } from '@/Infrastructure/Presentation/Obsidian/Commands/GoogleKeep/ImportKeepTakeoutCommand';

import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { DependencyContainer } from './DependencyContainer';
import { UnresolvedLinkGeneratorSettings } from './settings';
import type ObsidianExtension from './main';

export type NoteCommand = {
	id: string;
	name: string;
	callback: (file?: TFile) => any;
};

/**
 * Registers all plugin commands and returns the noteCommands array
 * for sharing with NoteOperationsView.
 */
export function buildNoteCommands(
	plugin: ObsidianExtension,
	container: DependencyContainer,
	settings: UnresolvedLinkGeneratorSettings,
): NoteCommand[] {
	const { llm, geminiImages, imageEnricher } = container;
	const { app } = plugin;

	return [
		{
			id: CommandEnum.ApplyTemplate,
			name: plugin.translationService.t('command.applyTemplate'),
			callback: async (file?: TFile) => {
				await new ApplyTemplateCommand(
					llm,
					imageEnricher,
					app,
					settings,
					plugin.translationService,
				).execute(file);
			},
		},
		{
			id: CommandEnum.ApplyTemplateWithUrl,
			name: plugin.translationService.t('command.applyTemplateWithUrl'),
			callback: async (file?: TFile) => {
				await new ApplyTemplateWithUrlCommand(
					llm,
					imageEnricher,
					app,
					settings,
					plugin.translationService,
				).execute(file);
			},
		},
		{
			id: CommandEnum.EnhanceByAi,
			name: plugin.translationService.t('command.enhanceByAi'),
			callback: async (file?: TFile) => {
				await new EnhanceByAiCommand(app, settings, llm, plugin.translationService).execute(file);
			},
		},
		{
			id: CommandEnum.EnrichWithPromptUrl,
			name: plugin.translationService.t('command.enrichWithPromptUrl'),
			callback: async (file?: TFile) => {
				await new EnrichWithPromptUrlCommand(
					llm,
					imageEnricher,
					app,
					settings,
					plugin.translationService,
				).execute(file);
			},
		},
		{
			id: CommandEnum.AddImages,
			name: plugin.translationService.t('command.addImages'),
			callback: async (file?: TFile) => {
				await new AddImagesCommand(app, imageEnricher, plugin.translationService).execute(file);
			},
		},
		{
			id: CommandEnum.CreateNoteFromImages,
			name: plugin.translationService.t('command.createNoteFromImages'),
			callback: async (file?: TFile) => {
				await new CreateNoteFromImagesCommand(app, geminiImages, plugin.translationService).execute(
					file,
				);
			},
		},
		{
			id: CommandEnum.ApplyTemplateFromImage,
			name: plugin.translationService.t('command.applyTemplateFromImage'),
			callback: async (file?: TFile) => {
				await new ApplyTemplateFromImageCommand(
					geminiImages,
					app,
					settings,
					plugin.translationService,
				).execute(file);
			},
		},
		{
			id: CommandEnum.RelocateNoteByLinkField,
			name: plugin.translationService.t('command.relocateNoteByLinkField'),
			callback: async (file?: TFile) => {
				await new RelocateNoteByLinkFieldCommand(app, plugin.translationService).execute(file);
			},
		},
		{
			id: CommandEnum.GenerateMissingNotesFromLinks,
			name: plugin.translationService.t('command.generateMissingNotes'),
			callback: async (file?: TFile) => {
				await new GenerateMissingNotesFromLinksCommand(
					app,
					settings,
					plugin.translationService,
				).execute(file);
			},
		},
		{
			id: CommandEnum.CreateReciprocityLinksNotes,
			name: plugin.translationService.t('command.createReciprocityLinksNotes'),
			callback: async (file?: TFile) => {
				await new CreateReciprocityLinksNotesCommand(app, plugin.translationService).execute(file);
			},
		},
		{
			id: CommandEnum.AnalyzeAndLinkEntities,
			name: plugin.translationService.t('command.analyzeAndLinkEntities'),
			callback: async (file?: TFile) => {
				await new AnalyzeAndLinkEntitiesCommand(app, llm, plugin.translationService).execute(file);
			},
		},
		{
			id: CommandEnum.GenerateMissingNotesFromListField,
			name: plugin.translationService.t('command.generateMissingNotesFromListField'),
			callback: async (file?: TFile) => {
				await new GenerateMissingNotesFromListFieldCommand(
					app,
					settings,
					llm,
					imageEnricher,
					plugin.translationService,
				).execute(file);
			},
		},
		{
			id: CommandEnum.InsertLinkToSelectedPhoto,
			name: plugin.translationService.t('command.insertLinkToSelectedPhoto'),
			callback: async (file?: TFile) => {
				await new InsertLinkToSelectedPhotoCommand(app, plugin.translationService).execute(file);
			},
		},
		{
			id: CommandEnum.OpenLinkedPhoto,
			name: plugin.translationService.t('command.openLinkedPhoto'),
			callback: async (file?: TFile) => {
				await new OpenLinkedPhotoCommand(app, plugin.translationService).execute(file);
			},
		},
		{
			id: 'elo-natural-language-search',
			name: plugin.translationService.t('command.naturalLanguageSearch'),
			callback: async () => {
				await new NaturalLanguageSearchCommand(app, llm, plugin.translationService).execute();
			},
		},

		{
			id: CommandEnum.TokenizeAndCreateDictionaryNotes,
			name: plugin.translationService.t('command.tokenizeAndCreateDictionaryNotes'),
			callback: async (file?: TFile) => {
				await new TokenizeAndCreateDictionaryNotesCommand(
					app,
					settings,
					plugin.translationService,
				).execute(file);
			},
		},
		{
			id: CommandEnum.ToggleHideEmptyProperties,
			name: plugin.translationService.t('command.toggleHideEmptyProperties'),
			callback: async () => {
				settings.hideEmptyProperties = !settings.hideEmptyProperties;
				await plugin.saveSettings();
				document.body.classList.toggle('hide-empty-properties', settings.hideEmptyProperties);

				const messageKey = settings.hideEmptyProperties
					? 'properties.hiddenMessage'
					: 'properties.visibleMessage';
				showMessage(messageKey, undefined, plugin.translationService);
			},
		},
	];
}
