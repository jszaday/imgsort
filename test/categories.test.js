import { describe, it, expect } from 'vitest';
import {
    RESERVED,
    MAX_FOLDERS,
    applyToggle,
    newCategoryError,
    isValidNewCategory,
    folderKey,
    folderKeyBadge,
} from '../lib/categories.js';

/** @param {Iterable<string>} it */
const sorted = it => [...it].sort();

describe('applyToggle', () => {
    it('adds a category', () => {
        expect(sorted(applyToggle(['uncategorized'], 'faves'))).toEqual(['faves', 'uncategorized']);
    });

    it('removes a category it already has', () => {
        expect(sorted(applyToggle(['faves', 'trip'], 'trip'))).toEqual(['faves']);
    });

    it('falls back to {uncategorized} when the last member is removed', () => {
        expect([...applyToggle(['faves'], 'faves')]).toEqual(['uncategorized']);
    });

    it('trash is exclusive: adding trash clears everything else', () => {
        expect([...applyToggle(['faves', 'trip'], 'trash')]).toEqual(['trash']);
    });

    it('trash is exclusive: adding a real category removes trash', () => {
        expect(sorted(applyToggle(['trash'], 'faves'))).toEqual(['faves']);
    });

    it('toggling trash off falls back to {uncategorized}', () => {
        expect([...applyToggle(['trash'], 'trash')]).toEqual(['uncategorized']);
    });

    it('does not mutate the input set', () => {
        const input = new Set(['uncategorized']);
        applyToggle(input, 'faves');
        expect([...input]).toEqual(['uncategorized']);
    });
});

describe('newCategoryError', () => {
    const folders = ['uncategorized', 'trash', 'trip'];
    it('rejects empty', () => {
        expect(newCategoryError('', folders)).toMatch(/empty/);
    });
    it('rejects separators', () => {
        expect(newCategoryError('a/b', folders)).toMatch(/"\/" or/);
        expect(newCategoryError('a\\b', folders)).toMatch(/"\/" or/);
    });
    it('rejects reserved names', () => {
        expect(newCategoryError('trash', folders)).toMatch(/reserved/);
        expect(newCategoryError('uncategorized', folders)).toMatch(/reserved/);
    });
    it('rejects duplicates', () => {
        expect(newCategoryError('trip', folders)).toMatch(/already exists/);
    });
    it('rejects when at the cap', () => {
        const full = Array.from({ length: MAX_FOLDERS }, (_, i) => `c${i}`);
        expect(newCategoryError('one-more', full)).toMatch(/Maximum of 35/);
    });
    it('accepts a fresh valid name', () => {
        expect(newCategoryError('paris', folders)).toBe('');
        expect(isValidNewCategory('paris', folders)).toBe(true);
        expect(isValidNewCategory('trash', folders)).toBe(false);
    });
});

describe('folderKey / folderKeyBadge', () => {
    it('digits for the first nine', () => {
        expect(folderKey(0)).toBe('1');
        expect(folderKey(8)).toBe('9');
        expect(folderKeyBadge(0, false)).toBe('1');
    });
    it('letters from the tenth on', () => {
        expect(folderKey(9)).toBe('a');
        expect(folderKey(34)).toBe('z');
        expect(folderKeyBadge(9, false)).toBe('A');
        expect(folderKeyBadge(9, true)).toBe('A'); // isMac does not change the badge today
    });
    it('RESERVED is the two reserved names', () => {
        expect(RESERVED).toEqual(['uncategorized', 'trash']);
    });
});
