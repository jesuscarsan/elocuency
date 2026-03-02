import { parseYaml, stringifyYaml } from 'obsidian';

export interface FrontmatterUpdateOptions {
	overwrite?: boolean;
}

type FrontmatterSplit = {
	frontmatterText: string | null;
	body: string;
};

export function stringifyFrontmatter(frontmatter: Record<string, unknown> | null): string {
	if (!frontmatter) {
		return '{}';
	}

	try {
		return JSON.stringify(frontmatter, (_key, value) => (value === undefined ? null : value), 2);
	} catch (error) {
		console.error('Failed to serialise frontmatter for Gemini prompt', error);
		return '{}';
	}
}

export function splitFrontmatter(content: string): FrontmatterSplit {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
	if (!match || match.index !== 0) {
		return {
			frontmatterText: null,
			body: content,
		};
	}

	const [block, text] = match;
	const body = content.slice(block.length);

	return {
		frontmatterText: text,
		body,
	};
}

export function parseFrontmatter(frontmatter: string | null): Record<string, unknown> | null {
	if (!frontmatter) {
		return null;
	}

	try {
		const parsed = parseYaml(frontmatter);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch (error) {
		console.error('Failed to parse frontmatter', error);
	}

	return null;
}

export function buildMergedFrontmatter(
	templateFrontmatter: string | null,
	currentFrontmatter: string | null,
): Record<string, unknown> | null {
	const templateData = parseFrontmatter(templateFrontmatter);
	const currentData = parseFrontmatter(currentFrontmatter);
	const mergedEntries: Array<[string, unknown]> = [];
	const keyPositions = new Map<string, number>();

	if (templateData) {
		for (const key of Object.keys(templateData)) {
			const templateValue = templateData[key];
			const currentValue = currentData ? currentData[key] : undefined;
			const valueToUse = hasMeaningfulValue(currentValue) ? currentValue : templateValue;

			upsertEntry(mergedEntries, keyPositions, key, valueToUse);
		}
	}

	if (currentData) {
		for (const key of Object.keys(currentData)) {
			const currentValue = currentData[key];
			if (!hasMeaningfulValue(currentValue)) {
				continue;
			}

			upsertEntry(mergedEntries, keyPositions, key, currentValue);
		}
	}

	if (mergedEntries.length === 0) {
		return null;
	}

	const merged: Record<string, unknown> = {};
	for (const [key, value] of mergedEntries) {
		merged[key] = value;
	}

	return merged;
}

export function formatFrontmatterBlock(data: Record<string, unknown>): string {
	const yaml = stringifyYaml(data).replace(/\s+$/, '');
	return `---\n${yaml}\n---`;
}

export function stripLeadingFrontmatter(text: string): string {
	const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
	if (!match || match.index !== 0) {
		return text;
	}

	return text.slice(match[0].length).replace(/^[\n\r]+/, '');
}

export function mergeFrontmatterSuggestions(
	current: Record<string, unknown> | null,
	suggestions?: Record<string, unknown>,
): Record<string, unknown> | null {
	if (!suggestions || Object.keys(suggestions).length === 0) {
		return current;
	}

	const base = current ? { ...current } : {};
	let changed = false;

	for (const [key, value] of Object.entries(suggestions)) {
		if (!hasMeaningfulValue(base[key]) && hasMeaningfulValue(value)) {
			base[key] = value;
			changed = true;
		}
	}

	if (!changed && current) {
		return current;
	}

	return changed ? base : null;
}

export function applyFrontmatterUpdates(
	current: Record<string, unknown> | null,
	updates: Record<string, unknown> | undefined | null,
): Record<string, unknown> | null {
	if (!updates || Object.keys(updates).length === 0) {
		return current;
	}

	const base = current ? { ...current } : {};
	let changed = false;

	for (const [key, value] of Object.entries(updates)) {
		// If the update has a meaningful value, apply it regardless of whether
		// the current key has a value or not. Overwrite is implied.
		if (hasMeaningfulValue(value)) {
			// Only update if the value is actually different?
			// For simplicity, we just check if it's meaningful to be applied.
			// Deep equality check might be better but for now naive replacement is consistent with "overwrite"
			if (JSON.stringify(base[key]) !== JSON.stringify(value)) {
				base[key] = value;
				changed = true;
			}
		}
	}

	if (!changed && current) {
		return current;
	}

	return changed ? base : null;
}

export function hasMeaningfulValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === 'string') {
		return value.trim().length > 0;
	}

	return true;
}

function upsertEntry(
	entries: Array<[string, unknown]>,
	positions: Map<string, number>,
	key: string,
	value: unknown,
): void {
	if (positions.has(key)) {
		const index = positions.get(key)!;
		entries[index][1] = value;
		return;
	}

	positions.set(key, entries.length);
	entries.push([key, value]);
}
