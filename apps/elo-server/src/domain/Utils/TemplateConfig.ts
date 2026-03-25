import {
  parseFrontmatter,
  splitFrontmatter,
  formatFrontmatterBlock,
} from './FrontmatterUtils';
import { LoggerPort } from '../ports/LoggerPort';

export interface TemplateConfig {
  commands?: string[];
  path?: string;
  prompt?: string;
  hasFrontmatter?: boolean;
  desambiguationSufix?: string;
  [key: string]: any;
}

export function extractConfigFromTemplate(content: string, logger?: LoggerPort): {
  config: TemplateConfig;
  cleanedContent: string;
} {
  const { frontmatterText, body } = splitFrontmatter(content);
  let config: TemplateConfig = {};
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
      config.hasFrontmatter = Object.keys(cleanFm).length > 0;
      const newFmBlock = Object.keys(cleanFm).length > 0 ? formatFrontmatterBlock(cleanFm) : '';
      cleanedContent = newFmBlock ? `${newFmBlock}\n${body}`.trimStart() : body.trimStart();

      if (newFmBlock && body) {
        cleanedContent = `${newFmBlock}\n${body}`;
      } else if (newFmBlock) {
        cleanedContent = newFmBlock;
      } else {
        cleanedContent = body;
      }
    } else {
      config.hasFrontmatter = Object.keys(cleanFm).length > 0;
    }
  }

  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
  let match;

  while ((match = jsonBlockRegex.exec(cleanedContent)) !== null) {
    try {
      let jsonContent;
      try {
        jsonContent = JSON.parse(match[1]);
      } catch (e) {
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
        cleanedContent = cleanedContent.replace(match[0], '').trim();
        jsonBlockRegex.lastIndex = 0;
      }
    } catch (e) {
      if (logger) {
        logger.warn(`Failed to parse JSON block in template: ${e}`);
      } else {
        console.warn('Failed to parse JSON block in template', e);
      }
    }
  }

  return { config, cleanedContent };
}
