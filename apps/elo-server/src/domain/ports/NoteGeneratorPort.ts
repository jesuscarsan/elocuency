export interface TemplateContext {
  path: string;
  description: string;
}

export interface NoteGenerationResult {
  title: string;
  content: string;
}

export interface TemplateMatch {
  templatePath: string;
  confidence: number;
  reasoning: string;
}

export interface NoteGeneratorPort {
  /**
   * Evaluates the user's prompt against available templates and selects the most appropriate ones.
   * Returns a list of potential matches with confidence scores.
   */
  classifyTemplates(prompt: string, templates: TemplateContext[]): Promise<TemplateMatch[]>;

  /**
   * Generates the final note content (including YAML frontmatter) by adapting the user's prompt
   * to the structure and instructions of the selected template.
   */
  generateNoteContent(prompt: string, templateContent: string): Promise<NoteGenerationResult>;

  /**
   * Evaluates if any of the provided notes (from search results) essentially represent 
   * the same concept/entity that the user is trying to create a new note for.
   * Returns the path of the matching note if certain, or null.
   */
  findExistingConcept(prompt: string, candidates: { path: string; content: string }[]): Promise<string | null>;
}
