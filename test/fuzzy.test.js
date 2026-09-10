import { describe, it, expect } from 'vitest';
import { fuzzyScore, fuzzyMatchIndices } from '../lib/fuzzy.js';

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

describe('fuzzyMatchIndices', () => {
    it('returns every position for an exact match', () => {
        expect(fuzzyMatchIndices('abc', 'abc')).toEqual([0, 1, 2]);
    });

    it('returns the greedy first-match positions for a scattered match', () => {
        expect(fuzzyMatchIndices('ac', 'abc')).toEqual([0, 2]);
        // 'trip/rome': greedy 'r' -> index 1 (in "trip"), then 'm' -> index 7
        expect(fuzzyMatchIndices('rm', 'trip/rome')).toEqual([1, 7]);
        expect(fuzzyMatchIndices('rome', 'trip/rome')).toEqual([1, 6, 7, 8]);
    });

    it('returns null for a non-subsequence', () => {
        expect(fuzzyMatchIndices('xyz', 'abc')).toBeNull();
        expect(fuzzyMatchIndices('cba', 'abc')).toBeNull();
    });

    it('returns null for an empty query', () => {
        expect(fuzzyMatchIndices('', 'abc')).toBeNull();
    });

    it('is case-insensitive but the indices map to the original string', () => {
        expect(fuzzyMatchIndices('bc', 'aBcD')).toEqual([1, 2]);
        expect(fuzzyMatchIndices('AB', 'ab')).toEqual([0, 1]);
    });
});
