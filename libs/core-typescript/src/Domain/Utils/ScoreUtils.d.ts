/**
 * Ensures importance is between 1 and 5.
 * @param importance The raw importance score.
 * @returns A number between 1 and 5.
 */
export declare function normalizeImportance(importance: number): number;
/**
 * Ensures difficulty is between 1 and 3.
 */
export declare function normalizeDifficulty(difficulty: number): number;
/**
 * Converts a difficulty score (1-3) to a mapped color.
 * 1: Baja (Green)
 * 2: Media (Orange)
 * 3: Alta (Red)
 */
export declare function difficultyToColor(difficulty: number): string;
