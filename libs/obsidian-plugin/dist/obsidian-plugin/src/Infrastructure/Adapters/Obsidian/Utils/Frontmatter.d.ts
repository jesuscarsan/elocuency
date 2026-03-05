export interface FrontmatterUpdateOptions {
    overwrite?: boolean;
}
declare type FrontmatterSplit = {
    frontmatterText: string | null;
    body: string;
};
export declare function stringifyFrontmatter(frontmatter: Record<string, unknown> | null): string;
export declare function splitFrontmatter(content: string): FrontmatterSplit;
export declare function parseFrontmatter(frontmatter: string | null): Record<string, unknown> | null;
export declare function buildMergedFrontmatter(templateFrontmatter: string | null, currentFrontmatter: string | null): Record<string, unknown> | null;
export declare function formatFrontmatterBlock(data: Record<string, unknown>): string;
export declare function stripLeadingFrontmatter(text: string): string;
export declare function mergeFrontmatterSuggestions(current: Record<string, unknown> | null, suggestions?: Record<string, unknown>): Record<string, unknown> | null;
export declare function applyFrontmatterUpdates(current: Record<string, unknown> | null, updates: Record<string, unknown> | undefined | null): Record<string, unknown> | null;
export declare function hasMeaningfulValue(value: unknown): boolean;
export {};
