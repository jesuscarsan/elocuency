import { NoteGeneratorPort, TemplateContext, NoteGenerationResult } from '../../domain/ports/NoteGeneratorPort';
import { TemplateCachePort } from '../../domain/ports/TemplateCachePort';
import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { Note } from '../../domain/Entities/Note';
import * as path from 'path';

export class GenerateNoteUseCase {
  constructor(
    private readonly noteGenerator: NoteGeneratorPort,
    private readonly templateCache: TemplateCachePort,
    private readonly noteRepository: NoteRepositoryPort,
    private readonly logger: LoggerPort
  ) {}

  public async execute(prompt: string): Promise<Note | null> {
    this.logger.info('Fetching available templates from cache...');
    const templatesList = await this.templateCache.getCachedTemplates();
    
    if (templatesList.length === 0) {
      throw new Error('No templates found in cache. Please build cache first.');
    }

    const contexts: TemplateContext[] = templatesList.map(t => ({
      path: t.template,
      description: t.description
    }));

    this.logger.info('Classifying prompt to select best template...');
    const selectedTemplatePath = await this.noteGenerator.classifyTemplate(prompt, contexts);

    if (!selectedTemplatePath) {
      this.logger.info('No suitable template found for the given prompt.');
      return null;
    }

    this.logger.info(`Selected template: ${selectedTemplatePath}`);

    // Read the template content
    // The relative path in the cache is relative to "!!metadata/templates"
    const fullTemplateId = path.join('!!metadata/templates', selectedTemplatePath);
    const templateNote = await this.noteRepository.getNoteById(fullTemplateId);

    if (!templateNote) {
      throw new Error(`Failed to read the selected template: ${selectedTemplatePath}`);
    }

    this.logger.info('Generating note content and adapting to template...');
    const generated = await this.noteGenerator.generateNoteContent(prompt, templateNote.content);

    // Save the new note
    // For simplicity, we can place them in an Inbox or root, or derive from template if needed.
    // Assuming placing in an Inbox directory or root with the generated title
    const newNoteId = `Inbox/${generated.title}.md`;
    
    const newNote = new Note(
      newNoteId,
      generated.title,
      generated.content,
      [], // Tags will be extracted if needed
      new Date(),
      new Date(),
      {} // Frontmatter will be parsed when re-reading, or could be extracted here
    );

    this.logger.info(`Saving new note: ${newNoteId}`);
    await this.noteRepository.saveNote(newNote);

    return newNote;
  }
}
