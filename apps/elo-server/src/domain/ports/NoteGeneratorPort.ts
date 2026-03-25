export interface TemplateContext {
  path: string;
  description: string;
}

export interface NoteGenerationResult {
  title: string;
  content: string;
}

export interface NoteGeneratorPort {
  /**
   * Evaluates the user's prompt against available templates and selects the most appropriate one.
   * Returns the path of the selected template, or null if none match well.
   */
  classifyTemplate(prompt: string, templates: TemplateContext[]): Promise<string | null>;

  /**
   * Generates the final note content (including YAML frontmatter) by adapting the user's prompt
   * to the structure and instructions of the selected template.
   */
  generateNoteContent(prompt: string, templateContent: string): Promise<NoteGenerationResult>;
}
