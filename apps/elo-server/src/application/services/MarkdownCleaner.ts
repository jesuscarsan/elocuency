import matter from 'gray-matter';
import YAML from 'yaml';
import path from 'path';

export class MarkdownCleaner {
  /**
   * Cleans a markdown note's content for RAG indexing.
   * - Removes empty YAML fields
   * - Strips YAML delimiters (---)
   * - Removes filename from path for context
   * - Strips Obsidian link brackets [[ ]]
   * - Removes empty brackets [ ]
   * - Normalizes whitespace
   */
  public clean(rawContent: string, options: { 
    title?: string, 
    path?: string,
    worldPath?: string
  } = {}): string {
    const { data, content } = matter(rawContent);

    // 1. Clean Frontmatter
    const cleanData = this.filterEmptyFields(data);
    let cleanedFrontmatter = '';
    if (Object.keys(cleanData).length > 0) {
      // Stringify without the YAML document delimiters (---)
      cleanedFrontmatter = YAML.stringify(cleanData).trim() + '\n\n';
    }

    // 2. Clean Path (Hidden for AI, used only as metadata)
    // We no longer add "Location: ..." to the context to avoid path noise.

    // 3. Final Global Cleanup (Both Frontmatter and Body)
    let finalResult = `${cleanedFrontmatter}${content}`.trim();

    // Strip Images: ![[...]] and ![]()
    finalResult = finalResult.replace(/!\[\[[^\]]+\]\]/g, '');
    finalResult = finalResult.replace(/!\[[^\]]*\]\([^)]+\)/g, '');

    // Strip Obsidian links: [[Link|Display]] -> Display, [[Link]] -> Link
    finalResult = finalResult.replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2');

    // Strip standard Markdown links: [Display](url) -> Display
    finalResult = finalResult.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Strip Task markers: [ ], [x], [X]
    finalResult = finalResult.replace(/\[[\sxX]\]/g, '');

    // Strip simple HTML tags: <br>, <div>, etc.
    finalResult = finalResult.replace(/<[^>]+>/g, ' ');

    // Handle Callout headers: > [!INFO] Title -> Title
    finalResult = finalResult.replace(/^>\s*\[![^\]]+\][ \t]*(.*)$/gm, '$1');

    // Normalize Whitespace
    // 1. Collapse 2+ horizontal spaces but NOT at the start of a line (preserve indentation)
    finalResult = finalResult.replace(/([^ \t\n])[ \t]{2,}/g, '$1 ');
    // 2. Collapse 3+ newlines into 2
    finalResult = finalResult.replace(/\n{3,}/g, '\n\n').trim();

    return finalResult;
  }

  private filterEmptyFields(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.isEmpty(value)) continue;

      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        const nested = this.filterEmptyFields(value);
        if (Object.keys(nested).length > 0) {
          result[key] = nested;
        }
      } else if (Array.isArray(value)) {
        const filteredArray = value.filter(item => !this.isEmpty(item));
        if (filteredArray.length > 0) {
          result[key] = filteredArray;
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
  }
}
