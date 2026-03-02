import { App, normalizePath, TFile } from 'obsidian';
import { UnresolvedLinkGeneratorSettings } from '../settings';
import { getTemplatesFolder, isFolderMatch } from '@elo/obsidian-plugin';
import {
	parseFrontmatter,
	splitFrontmatter,
	formatFrontmatterBlock,
} from '@/Domain/Utils/FrontmatterUtils';

export interface TemplateConfig {
	commands?: string[];
	path?: string;
	prompt?: string;
	hasFrontmatter?: boolean; // New field
	[key: string]: any;
}

export function extractConfigFromTemplate(content: string): {
	config: TemplateConfig;
	cleanedContent: string;
} {
	const { frontmatterText, body } = splitFrontmatter(content);
	let config: TemplateConfig = {};

	// Reconstruct content with cleaned frontmatter
	let cleanedContent = content;

	const parsedFrontmatter = parseFrontmatter(frontmatterText);

	if (parsedFrontmatter) {
		const cleanFm = { ...parsedFrontmatter };
		let modified = false;

		for (const key of Object.keys(parsedFrontmatter)) {
			if (key.startsWith('!!')) {
				const configKey = key.substring(2);
				config[configKey] = parsedFrontmatter[key];
				delete cleanFm[key];
				modified = true;
			}
		}

		if (modified) {
			// Check if there are any keys left after removing config keys
			config.hasFrontmatter = Object.keys(cleanFm).length > 0;

			const newFmBlock = Object.keys(cleanFm).length > 0 ? formatFrontmatterBlock(cleanFm) : '';

			// Reconstruct the file content: New FM + Body
			cleanedContent = newFmBlock ? `${newFmBlock}\n${body}`.trimStart() : body.trimStart();

			if (newFmBlock && body) {
				cleanedContent = `${newFmBlock}\n${body}`;
			} else if (newFmBlock) {
				cleanedContent = newFmBlock;
			} else {
				cleanedContent = body;
			}
		} else {
			// If no !! keys were found, does the file have frontmatter?
			// Yes, if cleanFm has keys.
			// Note: If we are not extracting config, maybe we don't care?
			// But if we use this valid template for a prompt (via JSON block?? no, JSON block is separate).
			// Actually, if there are NO !! keys, then `prompt` won't be set from Frontmatter.
			// But it might be set from JSON block below.
			// If prompt is set from JSON block, does `hasFrontmatter` matter?
			// "En buildPrompt si la template no tiene fronmatter"
			// If prompt comes from JSON block, we should probably check if there is YAML frontmatter too?
			// Let's assume consistent behavior: We want to know if there is YAML frontmatter.
			config.hasFrontmatter = Object.keys(cleanFm).length > 0;
		}
	}

	// 2. Extract from JSON Block (Legacy support or mixed usage)
	const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
	let match;

	// We search within the CLEANED content now?
	// Or original?
	// If we modified cleanedContent, we should probably search within that to remove JSON blocks if they still exist.
	// BUT, the regex indices might be messed up if we modify it in a loop.
	// Standard while loop with replace on string is safe enough if we update string.

	while ((match = jsonBlockRegex.exec(cleanedContent)) !== null) {
		try {
			let jsonContent;
			try {
				jsonContent = JSON.parse(match[1]);
			} catch (e) {
				// Fallback: try to parse as a JS object (permissive JSON)
				try {
					jsonContent = new Function('return ' + match[1])();
				} catch (e2) {
					throw e;
				}
			}

			if (jsonContent && (jsonContent.commands || jsonContent.prompt)) {
				config = {
					...config,
					...jsonContent,
				};
				// Remove the JSON block from the content
				cleanedContent = cleanedContent.replace(match[0], '').trim();
				// Reset regex because string changed?
				// Yes, modifying string invalidates `exec` state on cached regex usually or might skip.
				// Safer to reset distinct regex or just recursively replace.
				// Since we expect 1 usually, maybe just run it again?
				// actually `match` is dependent on the string.
				// If we replace, we should restart search or use replace with callback.
				// Let's use simple replace loop.
				jsonBlockRegex.lastIndex = 0; // Reset index
			}
		} catch (e) {
			console.warn('Failed to parse JSON block in template', e);
		}
	}

	return { config, cleanedContent };
}

export interface TemplateMatch {
	config: TemplateConfig;
	cleanedContent: string;
	templateFile: TFile;
}

export async function getAllTemplateConfigs(app: App): Promise<TemplateMatch[]> {
	const templatesFolder = getTemplatesFolder(app);
	if (!templatesFolder) {
		return [];
	}

	const matches: TemplateMatch[] = [];
	const templateFiles: TFile[] = [];

	// Helper to recursively get all md files in folder
	const collectFiles = (folderPath: string) => {
		const folder = app.vault.getAbstractFileByPath(folderPath);
		if (folder && 'children' in folder) {
			for (const child of (folder as any).children) {
				if (child instanceof TFile && child.extension === 'md') {
					templateFiles.push(child);
				} else if ('children' in child) {
					collectFiles(child.path);
				}
			}
		}
	};

	collectFiles(templatesFolder);

	for (const templateFile of templateFiles) {
		const templateContent = await app.vault.read(templateFile);
		const { config, cleanedContent } = extractConfigFromTemplate(templateContent);
		matches.push({ config, cleanedContent, templateFile });
	}

	return matches;
}
