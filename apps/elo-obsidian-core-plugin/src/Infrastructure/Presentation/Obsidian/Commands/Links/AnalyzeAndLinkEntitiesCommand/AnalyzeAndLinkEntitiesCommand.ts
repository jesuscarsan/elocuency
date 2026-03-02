import { App, MarkdownView, TFile, Notice } from 'obsidian';
import { LlmPort } from '@elo/core';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import {
	getActiveMarkdownView,
	executeInEditMode,
} from '@/Infrastructure/Presentation/Obsidian/Utils/ViewMode';
import {
	EntitySelectionModal,
	Entity,
} from '@/Infrastructure/Presentation/Obsidian/Views/Modals/EntitySelectionModal';

import { TranslationService } from '@elo/obsidian-plugin';

export class AnalyzeAndLinkEntitiesCommand {
	constructor(
		private readonly app: App,
		private readonly llm: LlmPort,
		private readonly translationService: TranslationService,
	) {}

	async execute(targetFile?: TFile) {
		console.log('[AnalyzeAndLinkEntitiesCommand] Start');
		const view = getActiveMarkdownView(this.app, targetFile);

		if (!view?.file) {
			showMessage('analyze.openNote', undefined, this.translationService);
			console.log('[AnalyzeAndLinkEntitiesCommand] End (No active view)');
			return;
		}

		const editor = view.editor;
		const noteContent = editor.getValue();
		const noteTitle = view.file.basename;

		showMessage('analyze.analyzing', undefined, this.translationService);

		const prompt = this.buildPrompt(noteTitle, noteContent);

		try {
			const entities = (await this.llm.requestJson({ prompt })) as Entity[];

			if (!entities || !Array.isArray(entities)) {
				showMessage('analyze.invalidResponse', undefined, this.translationService);
				console.log('[AnalyzeAndLinkEntitiesCommand] End (Invalid response)');
				return;
			}

			const highRelevanceEntities = entities.filter(
				(e) => e.relevance === 'High' || e.relevance === 'Medium',
			);

			if (highRelevanceEntities.length === 0) {
				showMessage('analyze.noRelevantEntities', undefined, this.translationService);
				console.log('[AnalyzeAndLinkEntitiesCommand] End (No relevant entities)');
				return;
			}

			new EntitySelectionModal(
				this.app,
				this.translationService,
				highRelevanceEntities,
				(selectedEntities) => {
					if (selectedEntities.length > 0) {
						executeInEditMode(view, async () => {
							this.processEntities(selectedEntities, view.editor);
						});
						showMessage(
							'analyze.processed',
							{ count: selectedEntities.length },
							this.translationService,
						);
					} else {
						showMessage('analyze.noSelection', undefined, this.translationService);
					}
				},
			).open();
		} catch (error) {
			console.error('Error analyzing entities:', error);
			showMessage('analyze.error', undefined, this.translationService);
		}
		console.log('[AnalyzeAndLinkEntitiesCommand] End');
	}

	private buildPrompt(title: string, content: string): string {
		return `
You are an expert knowledge graph builder using Obsidian.
Analyze the following note content and identify key entities that should be linked.

Note Title: "${title}"

Content:
"${content}"

Extract:
1.  **People** (Personas): Specific individuals mentioned.
2.  **Places** (Lugares): Locations, cities, countries.
3.  **Concepts** (Conceptos): Events or things with their own name.

Return a JSON ARRAY of objects. Each object must have:
- "name": The exact string occurrence in the text (case-sensitive preference, but normalize if needed).
- "type": "Person", "Place", or "Concept".
- "relevance": "High" (is important for general knowledge), "Medium" (is medium important for general knowledge), "Low" (is not important for general knowledge).

Example Output:
[
  { "name": "Elon Musk", "type": "Person", "relevance": "High" },
  { "name": "Mars", "type": "Place", "relevance": "Medium" }
]

CRITICAL: Return ONLY the JSON Array. No markdown formatting around it.
`;
	}

	private processEntities(entities: Entity[], editor: any) {
		let content = editor.getValue();

		// Sort entities by length (descending) to avoid replacing substrings of longer names first
		entities.sort((a, b) => b.name.length - a.name.length);

		const cache = this.app.metadataCache;

		// Find frontmatter end index
		const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
		const frontmatterMatch = content.match(frontmatterRegex);
		const frontmatterEndIndex = frontmatterMatch ? frontmatterMatch[0].length : 0;

		for (const entity of entities) {
			const name = entity.name;
			const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			// Use lookarounds for Unicode letters to support non-ASCII characters
			const regex = new RegExp(`(?<!\\p{L})${escapedName}(?!\\p{L})`, 'gu');

			content = content.replace(regex, (match: string, offset: number, string: string) => {
				// Check if we are inside a link
				if (this.isInsideLink(string, offset, match.length)) {
					return match;
				}

				const isInsideFrontmatter = offset < frontmatterEndIndex;
				const linkDest = cache.getFirstLinkpathDest(name, '');
				let linkText = `[[${match}]]`;

				if (linkDest && linkDest.basename !== match) {
					linkText = `[[${linkDest.basename}|${match}]]`;
				}

				if (isInsideFrontmatter) {
					// Check if already quoted
					const charBefore = offset > 0 ? string[offset - 1] : '';
					const charAfter =
						offset + match.length < string.length ? string[offset + match.length] : '';

					if (
						(charBefore === '"' && charAfter === '"') ||
						(charBefore === "'" && charAfter === "'")
					) {
						return linkText;
					}
					return `"${linkText}"`;
				}

				return linkText;
			});
		}

		if (content !== editor.getValue()) {
			editor.setValue(content);
		}
	}

	private isInsideLink(text: string, offset: number, length: number): boolean {
		// Simple check: look for nearest preceding '[[' and following ']]'
		// without an intervening ']]' before the '[['.

		const before = text.substring(0, offset);
		const after = text.substring(offset + length);

		const lastOpen = before.lastIndexOf('[[');
		const lastCloseBefore = before.lastIndexOf(']]');

		// If we found an opening bracket after the last closing bracket (or no closing bracket yet)
		const possibleOpen = lastOpen > lastCloseBefore;

		if (possibleOpen) {
			const nextClose = after.indexOf(']]');
			const nextOpen = after.indexOf('[[');

			// If there is a closing bracket coming up, and no opening bracket before it
			if (nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen)) {
				return true;
			}
		}

		return false;
	}
}
