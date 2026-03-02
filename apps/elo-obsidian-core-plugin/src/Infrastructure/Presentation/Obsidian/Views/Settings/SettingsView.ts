import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	DropdownComponent,
	TextComponent,
	TextAreaComponent,
} from 'obsidian';
import ObsidianExtension from '@/Infrastructure/Presentation/Obsidian/main';
import { LocationStrategy } from '@/Infrastructure/Presentation/Obsidian/settings';

export class SettingsView extends PluginSettingTab {
	plugin: ObsidianExtension;

	constructor(app: App, plugin: ObsidianExtension) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		const t = (key: string) => this.plugin.translationService.t(key);

		containerEl.createEl('h2', {
			text: t('settings.title'),
		});

		new Setting(containerEl)
			.setName(t('settings.userLanguageName'))
			.setDesc(t('settings.userLanguageDesc'))
			.addText((text: TextComponent) => {
				text
					.setPlaceholder('es')
					.setValue(this.plugin.settings.userLanguage)
					.onChange(async (value: string) => {
						this.plugin.settings.userLanguage = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t('settings.toLearnLanguageName'))
			.setDesc(t('settings.toLearnLanguageDesc'))
			.addText((text: TextComponent) => {
				text
					.setPlaceholder('en')
					.setValue(this.plugin.settings.toLearnLanguage)
					.onChange(async (value: string) => {
						this.plugin.settings.toLearnLanguage = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t('settings.locationStrategyName'))
			.setDesc(t('settings.locationStrategyDesc'))
			.addDropdown((dropdown: DropdownComponent) => {
				dropdown
					.addOption('same-folder', t('settings.locationStrategySame'))
					.addOption('fixed-folder', t('settings.locationStrategyFixed'))
					.setValue(this.plugin.settings.locationStrategy)
					.onChange(async (value: string) => {
						this.plugin.settings.locationStrategy = value as LocationStrategy;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName(t('settings.targetFolderName'))
			.setDesc(t('settings.targetFolderDesc'))
			.addText((text: TextComponent) => {
				text
					.setPlaceholder('inbox')
					.setValue(this.plugin.settings.targetFolder)
					.onChange(async (value: string) => {
						this.plugin.settings.targetFolder = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t('settings.templateName'))
			.setDesc(t('settings.templateDesc'))
			.addTextArea((text: TextAreaComponent) => {
				text
					.setPlaceholder('# {{title}}')
					.setValue(this.plugin.settings.missingNotesTemplatePath)
					.onChange(async (value: string) => {
						this.plugin.settings.missingNotesTemplatePath = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 4;
			});

		new Setting(containerEl)
			.setName(t('settings.geminiApiKeyName'))
			.setDesc(t('settings.geminiApiKeyDesc'))
			.addText((text: TextComponent) => {
				text
					.setPlaceholder('AIza...')
					.setValue(this.plugin.settings.geminiApiKey)
					.onChange(async (value: string) => {
						this.plugin.settings.geminiApiKey = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName(t('settings.googleApiKeyName'))
			.setDesc(t('settings.googleApiKeyDesc'))
			.addText((text: TextComponent) => {
				text
					.setPlaceholder('AIza...')
					.setValue(this.plugin.settings.googleCustomSearchApiKey)
					.onChange(async (value: string) => {
						this.plugin.settings.googleCustomSearchApiKey = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName(t('settings.googleEngineIdName'))
			.setDesc(t('settings.googleEngineIdDesc'))
			.addText((text: TextComponent) => {
				text
					.setPlaceholder('0123456789...')
					.setValue(this.plugin.settings.googleCustomSearchEngineId)
					.onChange(async (value: string) => {
						this.plugin.settings.googleCustomSearchEngineId = value.trim();
						await this.plugin.saveSettings();
					});
			});
	}
}
