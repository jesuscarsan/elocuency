import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { TemplateCachePort, TemplateInfo } from '../../domain/ports/TemplateCachePort';
import { LLMServicePort } from '../../domain/ports/LLMServicePort';
import { ImageSearchPort } from '../../domain/ports/ImageSearchPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { PersonasNoteOrganizer } from '../services/PersonasNoteOrganizer';
import { Note } from '../../domain/Entities/Note';
import {
  parseFrontmatter,
  splitFrontmatter,
  applyFrontmatterUpdates,
  formatFrontmatterBlock
} from '../../domain/Utils/FrontmatterUtils';
import { mergeNotes, mergeBodyContent } from '../../domain/Utils/NoteMerger';
import { extractConfigFromTemplate } from '../../domain/Utils/TemplateConfig';
import { ApplyTemplatePrompts } from '../../infrastructure/Prompts/ApplyTemplatePrompts';
import * as path from 'path';
import * as fs from 'fs';

interface RegistryEntry {
  key: string;
  isRelocateField?: boolean;
  relocatePriority?: number;
  reciprocityField?: string;
  amongField?: string;
}

interface EloConfig {
  frontmatterRegistry?: Record<string, RegistryEntry>;
  tagFolderMapping?: Record<string, string>;
  myWorldPath?: { placesTagsNameStart?: string; worldMemoryPath?: string };
  memory?: { worldPath?: string };
}

interface LLMEnrichment {
  frontmatter?: Record<string, unknown>;
  body?: string;
}

export interface ApplyTemplateRequest {
  targetNotePath: string;
  templateId?: string;
  promptUrl?: string;
}

export interface ApplyTemplateResponse {
  status: 'success' | 'needs_selection' | 'error';
  message?: string;
  matches?: TemplateInfo[];
  notePath?: string;
  commands?: string[];
}

export class ApplyTemplateAIUseCase {
  constructor(
    private readonly noteRepository: NoteRepositoryPort,
    private readonly templateCache: TemplateCachePort,
    private readonly llmService: LLMServicePort,
    private readonly imageSearch: ImageSearchPort,
    private readonly personasOrganizer: PersonasNoteOrganizer,
    private readonly logger: LoggerPort,
  ) { }

  async execute(request: ApplyTemplateRequest): Promise<ApplyTemplateResponse> {
    const note = await this.noteRepository.getNoteById(request.targetNotePath);
    if (!note) {
      return { status: 'error', message: 'Note not found' };
    }

    const templates = await this.templateCache.getCachedTemplates();
    if (templates.length === 0) {
      return { status: 'error', message: 'No templates found' };
    }

    let selectedTemplate: TemplateInfo | undefined;

    if (request.templateId) {
      selectedTemplate = templates.find(t => t.template === request.templateId);
      if (!selectedTemplate) return { status: 'error', message: 'Template not found' };
    } else {
      if (templates.length === 1) {
        selectedTemplate = templates[0];
      } else {
        return { status: 'needs_selection', matches: templates };
      }
    }

    return await this.applyTemplate(note.id, selectedTemplate, request.promptUrl);
  }

  private async applyTemplate(
    notePath: string,
    templateInfo: TemplateInfo,
    predefinedPromptUrl?: string,
  ): Promise<ApplyTemplateResponse> {
    const initialConceptName = path.basename(notePath, '.md');
    const fullTemplateId = path.join('!!config/templates', templateInfo.template);
    const templateNote = await this.noteRepository.getNoteById(fullTemplateId);

    if (!templateNote) {
      return { status: 'error', message: `Template file missing: ${templateInfo.template}` };
    }

    const { config, cleanedContent: cleanedTemplateContent } = extractConfigFromTemplate(templateNote.content, this.logger);

    const currentNote = await this.noteRepository.getNoteById(notePath);
    if (!currentNote) return { status: 'error', message: 'Note missing' };

    const mergedContent = mergeNotes(cleanedTemplateContent, currentNote.content, true);
    const mergedSplit = splitFrontmatter(mergedContent);
    let finalFrontmatter = parseFrontmatter(mergedSplit.frontmatterText);
    let finalBody = mergedSplit.body;

    const promptUrl = config.promptUrl || (finalFrontmatter && finalFrontmatter['!!promptUrl']) || predefinedPromptUrl;

    let currentNotePath = notePath;
    if (config.path && typeof config.path === 'string') {
      const targetPath = config.path.endsWith('.md')
        ? config.path
        : `${config.path.replace(/\/$/, '')}/${path.basename(currentNote.id)}`;

      if (currentNotePath !== targetPath) {
        await this.noteRepository.renameNote(currentNotePath, targetPath);
        currentNotePath = targetPath;
      }
    }

    const frontmatterBlock = finalFrontmatter ? formatFrontmatterBlock(finalFrontmatter) : '';
    const finalContent = [frontmatterBlock, finalBody].filter(Boolean).join('\n\n');

    const updatedNote = new Note(
      currentNotePath,
      currentNote.title,
      finalContent,
      currentNote.tags,
      currentNote.createdDate,
      new Date(),
      currentNote.properties
    );
    await this.noteRepository.saveNote(updatedNote);

    if (finalFrontmatter) {
      currentNotePath = await this.personasOrganizer.organize(currentNotePath, finalFrontmatter);
    }

    const commands: string[] = [];
    if (Array.isArray(config.commands)) {
      for (const cmdId of config.commands) {
        if (cmdId === 'ApplyPromptCommand') {
          currentNotePath = await this.executePromptLogic(currentNotePath, config, promptUrl as string);
        } else if (cmdId === 'elocuency:AddImagesCommand') {
          currentNotePath = await this.executeAddImagesLogic(currentNotePath);
        } else if (cmdId === 'elocuency:RelocateNoteByLinkFieldCommand') {
          currentNotePath = await this.executeRelocateNoteLogic(currentNotePath);
        } else if (cmdId === 'elocuency:CreateReciprocityLinksNotesCommand') {
          currentNotePath = await this.executeCreateReciprocityLinksLogic(currentNotePath);
        } else {
          commands.push(cmdId);
        }
      }
    }

    if (config.titlePattern && typeof config.titlePattern === 'string') {
      currentNotePath = await this.applyTitlePattern(currentNotePath, config.titlePattern, initialConceptName);
    }

    return {
      status: 'success',
      notePath: currentNotePath,
      commands: commands.length > 0 ? commands : undefined
    };
  }

  private loadEloConfig(): EloConfig {
    const workspacePath = process.env.ELO_WORKSPACE_PATH || '';
    const configPath = path.join(workspacePath, 'elo-config.json');
    if (!fs.existsSync(configPath)) return {};
    try {
      const sanitized = fs.readFileSync(configPath, 'utf8').replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(sanitized) as EloConfig;
    } catch (e) {
      this.logger.error(`ApplyTemplateUseCase config parse error: ${e}`);
      return {};
    }
  }

  private async executeAddImagesLogic(currentNotePath: string): Promise<string> {
    const finalNote = await this.noteRepository.getNoteById(currentNotePath);
    if (!finalNote) return currentNotePath;

    const split = splitFrontmatter(finalNote.content);
    let finalFm = parseFrontmatter(split.frontmatterText) || {};

    const existingImages = finalFm['!!images'] || finalFm['images'] || finalFm['EloImages'];
    if (Array.isArray(existingImages) && existingImages.length > 0) {
      return currentNotePath;
    }

    const filename = path.basename(currentNotePath);
    const title = filename.endsWith('.md') ? filename.slice(0, -3) : filename;

    const images = await this.imageSearch.searchImages(title, 3);

    if (images.length > 0) {
      finalFm['!!images'] = images;
      const frontmatterBlock = formatFrontmatterBlock(finalFm);
      const finalContent = [frontmatterBlock, split.body].filter(Boolean).join('\n\n');

      const updatedNote = new Note(
        currentNotePath,
        finalNote.title,
        finalContent,
        finalNote.tags,
        finalNote.createdDate,
        new Date(),
        finalNote.properties
      );
      await this.noteRepository.saveNote(updatedNote);
    }

    return currentNotePath;
  }

  private async executeRelocateNoteLogic(currentNotePath: string): Promise<string> {
    const finalNote = await this.noteRepository.getNoteById(currentNotePath);
    if (!finalNote) return currentNotePath;

    const split = splitFrontmatter(finalNote.content);
    const finalFm = parseFrontmatter(split.frontmatterText) || {};

    const eloConfig = this.loadEloConfig();

    const registry = eloConfig.frontmatterRegistry || {};
    const candidateFields = Object.values(registry).filter((e): e is RegistryEntry => !!e.isRelocateField);

    if (candidateFields.length === 0) return currentNotePath;

    candidateFields.sort((a, b) => {
      const priorityA = typeof a.relocatePriority === 'number' ? a.relocatePriority : 999;
      const priorityB = typeof b.relocatePriority === 'number' ? b.relocatePriority : 999;
      return priorityA - priorityB;
    });

    let targetFieldInfo = undefined;
    let rawValue = undefined;

    for (const candidate of candidateFields) {
      const val = finalFm[candidate.key];
      if (val !== undefined && val !== null && val !== '') {
        if (Array.isArray(val) && val.length === 0) continue;
        targetFieldInfo = candidate;
        rawValue = val;
        break;
      }
    }

    if (!targetFieldInfo || !rawValue) return currentNotePath;

    let linkText = '';
    if (Array.isArray(rawValue) && rawValue.length > 0) {
      linkText = rawValue[0];
    } else if (typeof rawValue === 'string') {
      linkText = rawValue;
    }

    if (!linkText) return currentNotePath;

    const linkMatch = linkText.match(/\[\[(.*?)(?:\|.*)?\]\]/);
    const pathOrName = linkMatch ? linkMatch[1] : linkText;

    const allNotes = await this.noteRepository.getAllNotes();
    const targetNote = allNotes.find(n => path.basename(n.id).toLowerCase() === `${pathOrName.toLowerCase()}.md` || path.basename(n.id).toLowerCase() === pathOrName.toLowerCase());

    if (!targetNote) {
      this.logger.warn(`executeRelocateNoteLogic: target note ${pathOrName} not found`);
      return currentNotePath;
    }

    const targetFolder = targetNote.id.substring(0, Math.max(0, targetNote.id.lastIndexOf('/')));
    if (!targetFolder) return currentNotePath;

    const activeFolder = currentNotePath.substring(0, Math.max(0, currentNotePath.lastIndexOf('/')));
    const activeFileName = path.basename(currentNotePath);

    if (activeFolder.endsWith(activeFileName.replace('.md', ''))) {
      // it's a folder note, don't move
      return currentNotePath;
    }

    const fmTags = finalFm['tags'] || finalFm['Tags'] || finalFm['tag'];
    let fmTagList = Array.isArray(fmTags) ? fmTags : fmTags ? [fmTags] : [];

    const allTags = [...(finalNote.tags || []), ...fmTagList];
    const normalizedTags = new Set(
      allTags
        .filter((t) => t !== null && t !== undefined)
        .map((t) => String(t).trim().normalize('NFC').toLowerCase().replace(/^#/, ''))
    );

    let targetFolderSuffix: string | undefined;
    const tagFolderMapping = eloConfig.tagFolderMapping || {};
    for (const [tagKey, folderSuffix] of Object.entries(tagFolderMapping)) {
      if (normalizedTags.has(tagKey.normalize('NFC').toLowerCase())) {
        targetFolderSuffix = folderSuffix as string;
        break;
      }
    }

    const locationsFolder = eloConfig.myWorldPath?.placesTagsNameStart || "Lugares/";
    const isTargetLugar = targetFolder.includes(locationsFolder.replace(/\/$/, ''));

    let finalFolderPath = targetFolder;
    if (isTargetLugar && targetFolderSuffix) {
      finalFolderPath = `${targetFolder}/${targetFolderSuffix}`;
    }

    if (activeFolder === finalFolderPath) {
      return currentNotePath;
    }

    const newPath = finalFolderPath ? `${finalFolderPath}/${activeFileName}` : activeFileName;
    await this.noteRepository.renameNote(currentNotePath, newPath);

    return newPath;
  }

  private async executeCreateReciprocityLinksLogic(currentNotePath: string): Promise<string> {
    const sourceNote = await this.noteRepository.getNoteById(currentNotePath);
    if (!sourceNote) return currentNotePath;

    const eloConfig = this.loadEloConfig();

    const registry = eloConfig.frontmatterRegistry || {};
    const registryEntries = Object.values(registry).filter((e): e is RegistryEntry => !!e.reciprocityField);

    if (registryEntries.length === 0) return currentNotePath;

    let allNotes = await this.noteRepository.getAllNotes();
    let currentContentChanged = false;
    let split = splitFrontmatter(sourceNote.content);
    let finalFm = parseFrontmatter(split.frontmatterText) || {};

    for (const entry of registryEntries) {
      const fieldKey = entry.key;
      const reciprocityKey = entry.reciprocityField;
      const amongKey = entry.amongField;
      const rawValue = finalFm[fieldKey];

      if (!rawValue) continue;

      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      const cleanNames = values
        .filter(v => typeof v === 'string')
        .map(v => v.replace(/\[\[|\]\]/g, '').split('|')[0].trim())
        .filter(v => v.length > 0);

      const processedFiles: string[] = [];

      for (let name of cleanNames) {
        let targetNote = allNotes.find(n => path.basename(n.id).toLowerCase() === `${name.toLowerCase()}.md` || path.basename(n.id).toLowerCase() === name.toLowerCase());

        if (!targetNote) {
          // Option B: create automatically
          let templateContent = '---\ntags: [Personas]\n---\n';
          const templateMatches = allNotes.filter(n => n.id.includes('Personas/Persona.md'));
          if (templateMatches.length > 0) {
            templateContent = templateMatches[0].content;
          }

          let newFilePath = `${name}.md`;
          let counter = 1;
          while (allNotes.some(n => n.id === newFilePath)) {
            newFilePath = `${name} ${counter}.md`;
            counter++;
          }

          const tmplSplit = splitFrontmatter(templateContent);
          const tmplFm = parseFrontmatter(tmplSplit.frontmatterText) || {};
          if (!tmplFm.tags) tmplFm.tags = [];
          if (Array.isArray(tmplFm.tags) && !tmplFm.tags.includes('Personas')) {
            tmplFm.tags.push('Personas');
          } else if (typeof tmplFm.tags === 'string' && tmplFm.tags !== 'Personas') {
            tmplFm.tags = [tmplFm.tags, 'Personas'];
          }

          const finalTmplBlock = formatFrontmatterBlock(tmplFm);
          const newContent = [finalTmplBlock, tmplSplit.body].filter(Boolean).join('\n\n');

          targetNote = new Note(newFilePath, name, newContent, [], new Date(), new Date(), {});
          await this.noteRepository.saveNote(targetNote);
          allNotes.push(targetNote);
        }

        processedFiles.push(targetNote.id);

        // Ensure source links to correct basename
        const newLink = `[[${path.basename(targetNote.id).replace('.md', '')}]]`;
        if (Array.isArray(finalFm[fieldKey])) {
          finalFm[fieldKey] = finalFm[fieldKey].map((v: string) => {
            const cleanV = typeof v === 'string' ? v.replace(/\[\[|\]\]/g, '').split('|')[0].trim() : '';
            return cleanV === name ? newLink : v;
          });
        } else if (typeof finalFm[fieldKey] === 'string') {
          const cleanV = finalFm[fieldKey].replace(/\[\[|\]\]/g, '').split('|')[0].trim();
          if (cleanV === name) {
            finalFm[fieldKey] = newLink;
          }
        }
        currentContentChanged = true;

        // Ensure reciprocity on targetNote
        if (reciprocityKey) {
          await this.addReciprocityLinkToNote(targetNote, path.basename(sourceNote.id).replace('.md', ''), reciprocityKey);
        }
      }

      if (amongKey && processedFiles.length > 1) {
        for (const fileId of processedFiles) {
          const noteObj = allNotes.find(n => n.id === fileId);
          if (!noteObj) continue;

          const others = processedFiles.filter(fid => fileId !== fid);
          for (const otherId of others) {
            const otherName = path.basename(otherId).replace('.md', '');
            await this.addReciprocityLinkToNote(noteObj, otherName, amongKey);
            // Updating noteObj directly in memory isn't strictly necessary as we already read from disk each time in addReciprocityLinkToNote, but let's refresh
            const updatedNoteObj = await this.noteRepository.getNoteById(fileId);
            if (updatedNoteObj) {
              const idx = allNotes.findIndex(n => n.id === fileId);
              if (idx !== -1) allNotes[idx] = updatedNoteObj;
            }
          }
        }
      }
    }

    if (currentContentChanged) {
      const frontmatterBlock = formatFrontmatterBlock(finalFm);
      const finalContent = [frontmatterBlock, split.body].filter(Boolean).join('\n\n');
      const updatedNote = new Note(
        currentNotePath,
        sourceNote.title,
        finalContent,
        sourceNote.tags,
        sourceNote.createdDate,
        new Date(),
        sourceNote.properties
      );
      await this.noteRepository.saveNote(updatedNote);
    }

    return currentNotePath;
  }

  private async addReciprocityLinkToNote(noteLoc: Note, targetName: string, reciprocityKey: string): Promise<void> {
    const split = splitFrontmatter(noteLoc.content);
    const fm = parseFrontmatter(split.frontmatterText) || {};
    const link = `[[${targetName}]]`;

    if (!fm[reciprocityKey]) {
      fm[reciprocityKey] = [link];
    } else {
      const current: string[] = Array.isArray(fm[reciprocityKey]) ? fm[reciprocityKey] : [fm[reciprocityKey]];
      const normalTarget = targetName.toLowerCase();
      const exists = current.some((v) => {
        if (typeof v !== 'string') return false;
        return v.replace(/\[\[|\]\]/g, '').split('|')[0].trim().toLowerCase() === normalTarget;
      });
      if (!exists) {
        current.push(link);
      }
      fm[reciprocityKey] = current;
    }

    const frontmatterBlock = formatFrontmatterBlock(fm);
    const finalContent = [frontmatterBlock, split.body].filter(Boolean).join('\n\n');

    const updatedNote = new Note(
      noteLoc.id,
      noteLoc.title,
      finalContent,
      noteLoc.tags,
      noteLoc.createdDate,
      new Date(),
      noteLoc.properties
    );
    await this.noteRepository.saveNote(updatedNote);
  }

  private async applyTitlePattern(currentNotePath: string, pattern: string, conceptName: string): Promise<string> {
    const finalNote = await this.noteRepository.getNoteById(currentNotePath);
    if (!finalNote) return currentNotePath;

    const split = splitFrontmatter(finalNote.content);
    const finalFm = parseFrontmatter(split.frontmatterText) || {};

    let newTitle = pattern.replace(/{concept}/gi, conceptName);

    const matches = newTitle.match(/\{(.*?)\}/g);
    if (matches) {
      for (const match of matches) {
        const field = match.slice(1, -1);
        const rawValue = finalFm[field] === undefined || finalFm[field] === null ? '' : finalFm[field];

        let cleanValue = '';
        if (Array.isArray(rawValue) && rawValue.length > 0) cleanValue = String(rawValue[0]);
        else if (typeof rawValue === 'string') cleanValue = rawValue;

        // Clean obsidian links: "[[Value|Alias]]" -> "Value"
        cleanValue = cleanValue.replace(/\[\[(.*?)\]\]/g, (_m, inner) => inner.split('|')[0]).trim();

        newTitle = newTitle.replace(match, cleanValue);
      }
    }

    // Cleanup potential artifact dashes/spaces if fields were missing inside the pattern
    newTitle = newTitle.replace(/\s+-\s+(?=-|\)|$)/g, ' ').replace(/\(\s*-\s*/g, '(').trim();

    // Cleanup any empty parentheses like () or ( ) if everything inside was empty
    newTitle = newTitle.replace(/\s*\(\s*\)$/, '').trim();

    if (!newTitle) newTitle = conceptName; // Fallback just in case

    const sanitizedTitle = newTitle.replace(/[\\/:*?"<>|\n\r]/g, '');

    const folderPath = currentNotePath.includes('/') ? currentNotePath.substring(0, currentNotePath.lastIndexOf('/')) : '';
    const newPath = folderPath ? `${folderPath}/${sanitizedTitle}.md` : `${sanitizedTitle}.md`;

    if (newPath !== currentNotePath) {
      await this.noteRepository.renameNote(currentNotePath, newPath);
      return newPath;
    }
    return currentNotePath;
  }

  private async executePromptLogic(
    notePath: string,
    config: any,
    promptUrl?: string,
  ): Promise<string> {
    const currentNote = await this.noteRepository.getNoteById(notePath);
    if (!currentNote) return notePath;

    const split = splitFrontmatter(currentNote.content);
    let finalFrontmatter: Record<string, unknown> | null =
      parseFrontmatter(split.frontmatterText) || {};
    let finalBody = split.body;

    let urlContext = '';
    if (promptUrl) {
      try {
        const fetchRes = await fetch(promptUrl);
        if (fetchRes.ok) {
          urlContext = await fetchRes.text();
        }
      } catch (e) {
        this.logger.error(`Error fetching prompt URL: ${e}`);
      }
    }

    const filename = path.basename(currentNote.id);
    const title = filename.endsWith('.md') ? filename.slice(0, -3) : filename;

    if (config.prompt && typeof config.prompt === 'string') {
      const promptText = this.buildPrompt(title, finalFrontmatter, config.prompt, finalBody, urlContext);

      try {
        const response = await this.llmService.ask({
          messages: [{ role: 'user', content: promptText }],
          systemPrompt: ApplyTemplatePrompts.systemPrompt
        });

        const enrichmentStr = response.content.trim().replace(/^```json/, '').replace(/```$/, '');
        let enrichment: LLMEnrichment | null = null;
        try {
          enrichment = JSON.parse(enrichmentStr);
        } catch (e) {
          this.logger.error("Failed to parse LLM JSON response");
        }

        if (enrichment) {
          if (enrichment.frontmatter) {
            delete enrichment.frontmatter.tags;
            delete enrichment.frontmatter.tag;
          }

          finalFrontmatter = applyFrontmatterUpdates(
            finalFrontmatter,
            enrichment.frontmatter,
            { overwrite: false }
          );

          if (enrichment.body !== undefined && enrichment.body !== null) {
            finalBody = mergeBodyContent(enrichment.body.trim(), finalBody);
          }
        }
      } catch (e: any) {
        this.logger.error(`Error calling LLM: ${e.message}`);
      }
    }

    const frontmatterBlock = finalFrontmatter ? formatFrontmatterBlock(finalFrontmatter) : '';
    const finalContent = [frontmatterBlock, finalBody].filter(Boolean).join('\n\n');

    const updatedNote = new Note(
      notePath,
      currentNote.title,
      finalContent,
      currentNote.tags,
      currentNote.createdDate,
      new Date(),
      currentNote.properties
    );
    await this.noteRepository.saveNote(updatedNote);
    return notePath;
  }

  private buildPrompt(
    title: string,
    currentFrontmatter: any,
    promptTemplate: string,
    currentBody: string,
    urlContext: string,
  ): string {
    const frontmatterCopy = currentFrontmatter ? { ...currentFrontmatter } : {};
    delete frontmatterCopy.tags;
    const frontmatterJson = JSON.stringify(frontmatterCopy, null, 2);

    return ApplyTemplatePrompts.buildUserPrompt(
      title,
      frontmatterJson,
      currentBody,
      urlContext,
      promptTemplate
    );
  }
}
