import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { TaskQueuePort, TaskType } from '../../domain/ports/TaskQueuePort';
import { ApplyTemplateAIUseCase } from '../../application/UseCases/ApplyTemplateAIUseCase';
import { Note } from '../../domain/Entities/Note';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { splitFrontmatter, parseFrontmatter, formatFrontmatterBlock } from '../../domain/Utils/FrontmatterUtils';

export interface ManageNoteInput {
  title: string;
  content?: string;
  frontmatter?: Record<string, any>;
  templateId?: string;
}

export class ManageNoteTool extends StructuredTool {
  name = 'manage_note';
  description = 'Creates or updates a conceptual note in the archive. Automatically handles folder structure (/!!archive/a-z/), ensures unique filenames (case-insensitive), identifies appropriate templates, and triggers RAG indexing.';

  schema = z.object({
    title: z.string().describe('The title of the note (e.g., "Artificial Intelligence").'),
    content: z.string().optional().describe('The markdown body of the note.'),
    frontmatter: z.record(z.string(), z.any()).optional().describe('Key-value pairs for the YAML frontmatter.'),
    templateId: z.string().optional().describe('Optional ID of the template to apply (e.g., "Personas/Persona.md").'),
  });

  constructor(
    private readonly noteRepository: NoteRepositoryPort,
    private readonly taskQueue: TaskQueuePort,
    private readonly applyTemplateUseCase: ApplyTemplateAIUseCase,
    private readonly logger: LoggerPort,
    private readonly memoryPath: string
  ) {
    super();
  }

  protected async _call(input: ManageNoteInput): Promise<string> {
    try {
      this.logger.info(`[ManageNoteTool] Called with title: ${input.title}`);

      // 1. Uniqueness & Path Resolution
      const allNotes = await this.noteRepository.getAllNotes();
      const filename = `${input.title}.md`;
      const lowercaseFilename = filename.toLowerCase();

      let targetPath: string | undefined;
      const existingNote = allNotes.find(n => path.basename(n.id).toLowerCase() === lowercaseFilename);

      if (existingNote) {
        targetPath = existingNote.id;
        this.logger.info(`[ManageNoteTool] Found existing note at: ${targetPath}`);
      } else {
        const firstLetter = input.title.charAt(0).toLowerCase();
        const subfolder = /[a-z0-9]/.test(firstLetter) ? firstLetter : '0';
        targetPath = `!!archive/${subfolder}/${filename}`;
        this.logger.info(`[ManageNoteTool] New note path: ${targetPath}`);
      }

      // 2. Initial Save (if new) or Load (if existing)
      if (!existingNote) {
        const newNote = new Note(
          targetPath,
          input.title,
          input.content || '',
          [],
          new Date(),
          new Date(),
          input.frontmatter || {}
        );
        await this.noteRepository.saveNote(newNote);
      }

      // 3. Template Application / Classification
      const applicationResult = await this.applyTemplateUseCase.execute({
        targetNotePath: targetPath,
        templateId: input.templateId,
      });

      if (applicationResult.status === 'needs_selection') {
        return JSON.stringify({
          status: 'needs_selection',
          message: 'Multiple templates match this note. Please select one.',
          options: applicationResult.matches?.map(m => ({ id: m.template, name: m.template })),
          notePath: targetPath
        });
      }

      if (applicationResult.status === 'error') {
        this.logger.warn(`[ManageNoteTool] Template application failed: ${applicationResult.message}`);
        // We still saved the note, but template failed. We'll continue.
      } else {
        targetPath = applicationResult.notePath || targetPath;
      }

      // 4. Update content if provided (merge with template results)
      if (input.content || input.frontmatter) {
        const currentNote = await this.noteRepository.getNoteById(targetPath);
        if (currentNote) {
          const split = splitFrontmatter(currentNote.content);
          let fm = parseFrontmatter(split.frontmatterText) || {};

          if (input.frontmatter) {
            fm = { ...fm, ...input.frontmatter };
          }

          const finalContent = [
            formatFrontmatterBlock(fm),
            input.content || split.body
          ].filter(Boolean).join('\n\n');

          const updatedNote = new Note(
            targetPath,
            currentNote.title,
            finalContent,
            currentNote.tags,
            currentNote.createdDate,
            new Date(),
            currentNote.properties
          );
          await this.noteRepository.saveNote(updatedNote);
        }
      }

      // 5. Signal RAG Reindexing
      await this.taskQueue.enqueue({
        payload: { type: TaskType.ReindexNote, notePath: targetPath }
      });

      return JSON.stringify({
        status: 'success',
        message: existingNote ? `Note "${input.title}" updated successfully.` : `Note "${input.title}" created successfully in archive.`,
        notePath: targetPath,
        templateApplied: applicationResult.status === 'success'
      });

    } catch (error: any) {
      this.logger.error(`[ManageNoteTool] Error: ${error.message}`);
      return JSON.stringify({
        status: 'error',
        message: `Failed to manage note: ${error.message}`
      });
    }
  }
}
