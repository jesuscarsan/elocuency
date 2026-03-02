import {
	NotificationPort,
	UIServicePort,
	CommandExecutorPort,
	EditorPort,
	TranslationService,
} from '@elo/obsidian-plugin';
import { NoteRepositoryPort } from '../Domain/Ports/NoteRepositoryPort';
import { TemplateRepositoryPort } from '../Domain/Ports/TemplateRepositoryPort';
import { ImageServicePort } from '../Domain/Ports/ImageServicePort';
import { NetworkPort } from '../Domain/Ports/NetworkPort';
import { LlmPort } from '@elo/core';

/**
 * Factory for creating mock NotificationPort
 */
export function createMockNotificationPort(): jest.Mocked<NotificationPort> {
	return {
		showMessage: jest.fn(),
		showError: jest.fn(),
	};
}

/**
 * Factory for creating mock UIServicePort
 */
export function createMockUIServicePort(): jest.Mocked<UIServicePort> {
	return {
		showMessage: jest.fn(),
		showSelectionModal: jest.fn(),
	};
}

/**
 * Factory for creating mock NoteRepositoryPort
 */
export function createMockNoteRepositoryPort(): jest.Mocked<NoteRepositoryPort> {
	return {
		getNote: jest.fn(),
		saveNote: jest.fn(),
		createNote: jest.fn(),
		deleteNote: jest.fn(),
		renameNote: jest.fn(),
		getAllNotes: jest.fn(),
		resolvePath: jest.fn(),
	};
}

/**
 * Factory for creating mock TemplateRepositoryPort
 */
export function createMockTemplateRepositoryPort(): jest.Mocked<TemplateRepositoryPort> {
	return {
		getAllTemplates: jest.fn(),
	};
}

/**
 * Factory for creating mock LlmPort
 */
export function createMockLlmPort(): jest.Mocked<LlmPort> {
	return {
		requestEnrichment: jest.fn(),
		requestJson: jest.fn(),
	} as any;
}

/**
 * Factory for creating mock ImageServicePort
 */
export function createMockImageServicePort(): jest.Mocked<ImageServicePort> {
	return {
		searchImages: jest.fn(),
	};
}

/**
 * Factory for creating mock CommandExecutorPort
 */
export function createMockCommandExecutorPort(): jest.Mocked<CommandExecutorPort> {
	return {
		executeCommand: jest.fn(),
	};
}

/**
 * Factory for creating mock NetworkPort
 */
export function createMockNetworkPort(): jest.Mocked<NetworkPort> {
	return {
		getText: jest.fn(),
	};
}

/**
 * Factory for creating mock EditorPort
 */
export function createMockEditorPort(): jest.Mocked<EditorPort> {
	return {
		getValue: jest.fn(),
		setValue: jest.fn(),
		getNoteTitle: jest.fn(),
		getSelectedText: jest.fn(),
		replaceSelection: jest.fn(),
		getCursorPosition: jest.fn(),
		setCursorPosition: jest.fn(),
		insertAtCursor: jest.fn(),
		getNotePath: jest.fn(),
	};
}

export function createMockTranslationService(): any {
	return {
		t: jest.fn((key: string, args?: any) => {
			let val = key;
			if (args) {
				Object.entries(args).forEach(([k, v]) => {
					val += `\n${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`;
				});
			}
			return val;
		}),
	};
}
