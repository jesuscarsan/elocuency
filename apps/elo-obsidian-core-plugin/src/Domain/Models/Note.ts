export interface Note {
    path: string;
    content: string;
    frontmatter: Record<string, unknown>;
    body: string;
}
