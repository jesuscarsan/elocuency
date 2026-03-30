import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { TemplateCachePort, TemplateInfo } from '../../domain/ports/TemplateCachePort';
import { WebSearchPort } from '../../domain/ports/WebSearchPort';
import { TaskQueuePort, TaskType } from '../../domain/ports/TaskQueuePort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { splitFrontmatter, parseFrontmatter, formatFrontmatterBlock } from '../../domain/Utils/FrontmatterUtils';
import { Note } from '../../domain/Entities/Note';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import * as path from 'node:path';

export class ProcessInboxUseCase {
  constructor(
    private readonly noteRepository: NoteRepositoryPort,
    private readonly templateCache: TemplateCachePort,
    private readonly baseLLM: BaseChatModel,
    private readonly webSearch: WebSearchPort,
    private readonly taskQueue: TaskQueuePort,
    private readonly logger: LoggerPort
  ) { }

  async execute(): Promise<void> {
    this.logger.info('[ProcessInbox] Starting inbox scan...');
    const allNotes = await this.noteRepository.getAllNotes();

    const inboxNotes = allNotes.filter(n =>
      n.id.toLowerCase().startsWith('inbox/log-') &&
      !n.id.includes('!!config')
    );

    for (const note of inboxNotes) {
      const split = splitFrontmatter(note.content);
      const fm = parseFrontmatter(split.frontmatterText) || {};

      if (fm['!!status'] === 'processed') continue;

      this.logger.info(`[ProcessInbox] Processing context for: ${note.id}`);
      
      const templates = await this.templateCache.getCachedTemplates();
      // Step 2 & 3: Extract Entities and their template candidates
      const extractedConcepts = await this.extractAndMapEntities(note.content, templates);

      this.logger.info(`[ProcessInbox] Extracted ${extractedConcepts.length} concepts for ${note.id}`);

      const generatedNotes: { finalPath: string; title: string; templatePath: string }[] = [];

      for (const concept of extractedConcepts) {
        // Find best template
        const bestCandidate = concept.templateCandidates.sort((a,b) => b.confidence - a.confidence)[0];
        if (!bestCandidate || bestCandidate.confidence < 0.6) {
          this.logger.warn(`[ProcessInbox] Skipping concept ${concept.name} (no confident template found)`);
          continue;
        }

        // Step 4: Web Search Enrichment
        this.logger.info(`[ProcessInbox] Searching Google for context on: ${concept.name}`);
        let searchContext = 'No external search context found.';
        try {
          const searchResults = await this.webSearch.search(`${concept.name} ${concept.type}`, 3);
          if (searchResults.length > 0) {
            searchContext = searchResults.map(r => `[${r.title}](${r.link}): ${r.snippet}`).join('\n');
          }
        } catch (e) {
          this.logger.warn(`[ProcessInbox] Web search failed for ${concept.name}: ${e}`);
        }

        // Extract expected template fields
        const templateFields = await this.getTemplateFields(bestCandidate.templatePath);

        // Step 5: Data Formatting (Frontmatter & Body generation)
        const formatSchema = z.object({
          titlePattern: z.string().describe("Semantic Obsidian note name without extension (e.g. 'Matrix (Película)')"),
          frontmatterJson: z.string().describe("A JSON string representing the YAML frontmatter object. DO NOT use fancy types, just a plain JSON string."),
          body: z.string().describe("The lean markdown body text containing factual descriptions")
        });

        const formatter = this.baseLLM.withStructuredOutput(formatSchema);
        
        let otherLinks = extractedConcepts.filter(c => c.name !== concept.name).map(c => c.name).join(', ');

        const systemPrompt = `You are an AI Librarian creating a definitive note. 
Concept: "${concept.name}" (Type: ${concept.type})
Expected Metadata Fields from Template: ${templateFields.join(', ')}

Original Request & Context:
${note.content}

Google Search Context: 
${searchContext}

Other entities extracted in the same batch (consider linking them via frontmatter if applicable): ${otherLinks}

CRITICAL RULES:
1. "frontmatter" must populate the Expected Metadata Fields based on the context. If a field represents another concept/entity, wrap it in Obsidian brackets e.g. "[[Name]]". Make relations explicit in frontmatter arrays if needed.
2. "body" should be lean, factual markdown text.
3. "titlePattern" should be the definitive Obsidian filename based on semantic rules.`;

        let res: { titlePattern: string; frontmatterJson: string; body: string };
        try {
          res = await formatter.invoke(systemPrompt);
        } catch (e) {
          this.logger.error(`[ProcessInbox] LLM formatting failed for ${concept.name}: ${e}`);
          continue;
        }

        // Step 6: Create and Relocate Semantic Note
        let parsedFrontmatter: Record<string, any> = {};
        try {
            parsedFrontmatter = JSON.parse(res.frontmatterJson);
        } catch (e) {
            this.logger.error(`[ProcessInbox] Failed to parse frontmatter JSON for ${concept.name}: ${res.frontmatterJson}`);
        }
        
        const sanitizedTitle = res.titlePattern.replace(/[\\/:*?"<>|"\n\r]/g, '').trim();
        const finalPath = `Archive/A/${sanitizedTitle}.md`; // Base archive, but ApplyTemplate might relocate it
        
        const newNoteFM = Object.assign({}, parsedFrontmatter);
        newNoteFM['template'] = path.basename(bestCandidate.templatePath, '.md');

        const newNoteContent = [
          formatFrontmatterBlock(newNoteFM),
          res.body
        ].filter(Boolean).join('\n\n');

        const semanticNote = new Note(
          finalPath,
          sanitizedTitle,
          newNoteContent,
          [],
          new Date(),
          new Date(),
          newNoteFM
        );

        try {
          await this.noteRepository.saveNote(semanticNote);
        } catch (e) {
          this.logger.error(`[ProcessInbox] Failed to save note ${finalPath}: ${e}`);
          continue;
        }
        generatedNotes.push({ finalPath, title: sanitizedTitle, templatePath: bestCandidate.templatePath });

        // Enqueue Apply Template to normalize and relocate
        await this.taskQueue.enqueue({
          payload: {
            type: TaskType.ApplyTemplate,
            targetNotePath: finalPath,
            templateId: bestCandidate.templatePath
          }
        });
        
        this.logger.info(`[ProcessInbox] Semantic note created: ${finalPath}`);
      }

      // Step 7: Update initial Inbox file -> mark processed
      fm['!!status'] = 'processed';
      fm['!!generated_notes'] = generatedNotes.map(gn => `[[${gn.title}]]`);
      
      const finalFm = formatFrontmatterBlock(fm);
      const FinalNote = new Note(
        note.id, note.title, `${finalFm}\n\n${split.body}`, note.tags, note.createdDate, new Date(), fm
      );
      await this.noteRepository.saveNote(FinalNote);
      this.logger.info(`[ProcessInbox] Inbox note ${note.id} processed successfully`);
    }
  }

  private async extractAndMapEntities(content: string, templates: TemplateInfo[]) {
    const templatesStr = templates.map(t => `- Path: ${t.template} | Desc: ${t.description}`).join('\n');

    const schema = z.object({
      concepts: z.array(z.object({
        name: z.string(),
        type: z.string(),
        templateCandidates: z.array(z.object({
          templatePath: z.string(),
          confidence: z.number().describe("0.0 to 1.0"),
          reasoning: z.string()
        }))
      }))
    });

    const extractor = this.baseLLM.withStructuredOutput(schema);
    const prompt = `Read the following raw note data and extract all primary entities/concepts that should be converted into separate knowledge base notes.

Raw Data:
${content}

Available Templates:
${templatesStr}

For each entity, determine its type and list the best template candidates from the list above.`;

    try {
      const res = await extractor.invoke(prompt);
      return res.concepts;
    } catch (e) {
      this.logger.error(`[ProcessInbox] Entity extraction LLM call failed: ${e}`);
      return [];
    }
  }

  private async getTemplateFields(templatePath: string): Promise<string[]> {
    const fullPath = `!!config/templates/${templatePath}`;
    const note = await this.noteRepository.getNoteById(fullPath);
    if (!note) return [];
    const split = splitFrontmatter(note.content);
    const fm = parseFrontmatter(split.frontmatterText) || {};
    return Object.keys(fm).filter(k => !k.startsWith('!!'));
  }
}
