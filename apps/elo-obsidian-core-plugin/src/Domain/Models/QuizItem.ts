export interface QuizItem {
    heading: string;
    blockId: string;
    text: string;
    range: { start: number, end: number };
}
