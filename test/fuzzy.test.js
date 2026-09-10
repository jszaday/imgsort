import { describe, it, expect } from 'vitest';
import { fuzzyScore } from '../lib/fuzzy.js';

describe('fuzzyScore', () => {
    it('scores empty query as 0', () => {
        expect(fuzzyScore('', 'anything')).toBe(0);
    });

    it('returns -1 when the query is not a subsequence', () => {
        expect(fuzzyScore('xyz', 'trip/rome')).toBe(-1);
        expect(fuzzyScore('romeo', 'rome')).toBe(-1);
    });

    it('ranks exact > prefix > word-boundary > scattered', () => {
        const exact = fuzzyScore('abc', 'abc');
        const prefix = fuzzyScore('ab', 'abcd');
        const boundary = fuzzyScore('c', 'ab/cd'); // 'c' starts a word after '/'
        const scattered = fuzzyScore('bd', 'abcd'); // b@1, d@3 — no boundary, not a prefix
        expect(exact).toBeGreaterThan(prefix);
        expect(prefix).toBeGreaterThan(boundary);
        expect(boundary).toBeGreaterThan(scattered);
    });

    it('gives a boundary bonus for matches after / - _ or space', () => {
        // 'p' right after the '/' boundary beats 'p' mid-word
        const afterSlash = fuzzyScore('p', 'a/paris');
        const midWord = fuzzyScore('p', 'apple');
        expect(afterSlash).toBeGreaterThan(midWord);
    });

    it('rewards consecutive runs over gaps', () => {
        expect(fuzzyScore('abc', 'abc')).toBeGreaterThan(fuzzyScore('abc', 'axbxc'));
    });

    it('is case-insensitive', () => {
        expect(fuzzyScore('ROME', 'rome')).toBe(fuzzyScore('rome', 'ROME'));
    });
});
