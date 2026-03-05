import { describe, it, expect } from 'vitest';
import { normalizeImportance, normalizeDifficulty, difficultyToColor } from './ScoreUtils';

describe('ScoreUtils', () => {
    describe('normalizeImportance', () => {
        it('should return 1 for importance <= 1', () => {
            expect(normalizeImportance(0)).toBe(1);
            expect(normalizeImportance(1)).toBe(1);
            expect(normalizeImportance(-5)).toBe(1);
        });

        it('should return 5 for importance >= 5', () => {
            expect(normalizeImportance(5)).toBe(5);
            expect(normalizeImportance(10)).toBe(5);
        });

        it('should round values between 1 and 5', () => {
            expect(normalizeImportance(2.4)).toBe(2);
            expect(normalizeImportance(2.6)).toBe(3);
            expect(normalizeImportance(3)).toBe(3);
        });
    });

    describe('normalizeDifficulty', () => {
        it('should return 1 for difficulty <= 1', () => {
            expect(normalizeDifficulty(0)).toBe(1);
            expect(normalizeDifficulty(1)).toBe(1);
        });

        it('should return 3 for difficulty >= 3', () => {
            expect(normalizeDifficulty(3)).toBe(3);
            expect(normalizeDifficulty(5)).toBe(3);
        });

        it('should round values between 1 and 3', () => {
            expect(normalizeDifficulty(1.4)).toBe(1);
            expect(normalizeDifficulty(1.6)).toBe(2);
            expect(normalizeDifficulty(2.4)).toBe(2);
            expect(normalizeDifficulty(2.6)).toBe(3);
        });
    });

    describe('difficultyToColor', () => {
        it('should return green for difficulty 1', () => {
            expect(difficultyToColor(1)).toBe('#50fa7b');
            expect(difficultyToColor(0)).toBe('#50fa7b');
        });

        it('should return orange for difficulty 2', () => {
            expect(difficultyToColor(2)).toBe('#ffb86c');
            expect(difficultyToColor(1.6)).toBe('#ffb86c');
        });

        it('should return red for difficulty 3', () => {
            expect(difficultyToColor(3)).toBe('#ff5555');
            expect(difficultyToColor(5)).toBe('#ff5555');
        });
    });
});
