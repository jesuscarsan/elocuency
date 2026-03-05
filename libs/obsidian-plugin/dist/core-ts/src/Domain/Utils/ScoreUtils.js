"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.difficultyToColor = exports.normalizeDifficulty = exports.normalizeImportance = void 0;
/**
 * Ensures importance is between 1 and 5.
 * @param importance The raw importance score.
 * @returns A number between 1 and 5.
 */
function normalizeImportance(importance) {
    if (importance <= 1)
        return 1;
    if (importance >= 5)
        return 5;
    return Math.round(importance);
}
exports.normalizeImportance = normalizeImportance;
/**
 * Ensures difficulty is between 1 and 3.
 */
function normalizeDifficulty(difficulty) {
    if (difficulty <= 1)
        return 1;
    if (difficulty >= 3)
        return 3;
    return Math.round(difficulty);
}
exports.normalizeDifficulty = normalizeDifficulty;
/**
 * Converts a difficulty score (1-3) to a mapped color.
 * 1: Baja (Green)
 * 2: Media (Orange)
 * 3: Alta (Red)
 */
function difficultyToColor(difficulty) {
    const normalized = normalizeDifficulty(difficulty);
    if (normalized === 1)
        return '#50fa7b'; // Green
    if (normalized === 2)
        return '#ffb86c'; // Orange
    return '#ff5555'; // Red
}
exports.difficultyToColor = difficultyToColor;
