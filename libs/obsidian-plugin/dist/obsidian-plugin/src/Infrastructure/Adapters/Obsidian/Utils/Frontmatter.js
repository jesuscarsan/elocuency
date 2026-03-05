"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasMeaningfulValue = exports.applyFrontmatterUpdates = exports.mergeFrontmatterSuggestions = exports.stripLeadingFrontmatter = exports.formatFrontmatterBlock = exports.buildMergedFrontmatter = exports.parseFrontmatter = exports.splitFrontmatter = exports.stringifyFrontmatter = void 0;
const obsidian_1 = require("obsidian");
function stringifyFrontmatter(frontmatter) {
    if (!frontmatter) {
        return '{}';
    }
    try {
        return JSON.stringify(frontmatter, (_key, value) => (value === undefined ? null : value), 2);
    }
    catch (error) {
        console.error('Failed to serialise frontmatter for Gemini prompt', error);
        return '{}';
    }
}
exports.stringifyFrontmatter = stringifyFrontmatter;
function splitFrontmatter(content) {
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
exports.splitFrontmatter = splitFrontmatter;
function parseFrontmatter(frontmatter) {
    if (!frontmatter) {
        return null;
    }
    try {
        const parsed = (0, obsidian_1.parseYaml)(frontmatter);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
    }
    catch (error) {
        console.error('Failed to parse frontmatter', error);
    }
    return null;
}
exports.parseFrontmatter = parseFrontmatter;
function buildMergedFrontmatter(templateFrontmatter, currentFrontmatter) {
    const templateData = parseFrontmatter(templateFrontmatter);
    const currentData = parseFrontmatter(currentFrontmatter);
    const mergedEntries = [];
    const keyPositions = new Map();
    if (templateData) {
        for (const key of Object.keys(templateData)) {
            const templateValue = templateData[key];
            const currentValue = currentData ? currentData[key] : undefined;
            const valueToUse = hasMeaningfulValue(currentValue)
                ? currentValue
                : templateValue;
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
    const merged = {};
    for (const [key, value] of mergedEntries) {
        merged[key] = value;
    }
    return merged;
}
exports.buildMergedFrontmatter = buildMergedFrontmatter;
function formatFrontmatterBlock(data) {
    const yaml = (0, obsidian_1.stringifyYaml)(data).replace(/\s+$/, '');
    return `---\n${yaml}\n---`;
}
exports.formatFrontmatterBlock = formatFrontmatterBlock;
function stripLeadingFrontmatter(text) {
    const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
    if (!match || match.index !== 0) {
        return text;
    }
    return text.slice(match[0].length).replace(/^[\n\r]+/, '');
}
exports.stripLeadingFrontmatter = stripLeadingFrontmatter;
function mergeFrontmatterSuggestions(current, suggestions) {
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
exports.mergeFrontmatterSuggestions = mergeFrontmatterSuggestions;
function applyFrontmatterUpdates(current, updates) {
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
exports.applyFrontmatterUpdates = applyFrontmatterUpdates;
function hasMeaningfulValue(value) {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value).length > 0;
    }
    return true;
}
exports.hasMeaningfulValue = hasMeaningfulValue;
function upsertEntry(entries, positions, key, value) {
    if (positions.has(key)) {
        const index = positions.get(key);
        entries[index][1] = value;
        return;
    }
    positions.set(key, entries.length);
    entries.push([key, value]);
}
