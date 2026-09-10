import { describe, it, expect } from 'vitest';
import {
    RESERVED,
    MAX_FOLDERS,
    applyToggle,
    newCategoryError,
    isValidNewCategory,
    folderKey,
    folderKeyBadge,
    countLabels,
    applyCountDelta,
    sortFolders,
} from '../lib/categories.js';

/** @param {Iterable<string>} it */
const sorted = it => [...it].sort();

describe('applyToggle', () => {
    it('adds a category', () => {
        expect(sorted(applyToggle(['portrait'], 'faves'))).toEqual(['faves', 'portrait']);
    });

    it('adding a real category clears the default `uncategorized` bucket', () => {
        expect([...applyToggle(['uncategorized'], 'faves')]).toEqual(['faves']);
    });

    it('adding `uncategorized` itself does not self-clear', () => {
        expect(sorted(applyToggle(['faves'], 'uncategorized'))).toEqual(['faves', 'uncategorized']);
    });

    it('clearUncategorized:false keeps `uncategorized` sticky', () => {
        expect(
            sorted(applyToggle(['uncategorized'], 'faves', { clearUncategorized: false }))
        ).toEqual(['faves', 'uncategorized']);
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

describe('countLabels', () => {
    it('counts every label across all sets', () => {
        const counts = countLabels([
            new Set(['a', 'b']),
            new Set(['a']),
            new Set(['trash']),
            new Set(['a', 'b', 'c']),
        ]);
        expect(Object.fromEntries(counts)).toEqual({ a: 3, b: 2, c: 1, trash: 1 });
    });
    it('empty input -> empty map', () => {
        expect(countLabels([]).size).toBe(0);
    });
});

describe('sortFolders', () => {
    const folders = ['uncategorized', 'trash', 'Zebra', 'apple', 'mango'];

    it('pins uncategorized then trash first regardless of source order', () => {
        expect(sortFolders(['mango', 'trash', 'apple', 'uncategorized'], { by: 'added' })).toEqual([
            'uncategorized',
            'trash',
            'mango',
            'apple',
        ]);
    });

    it("'alpha' (default) sorts the rest case-insensitively", () => {
        expect(sortFolders(folders)).toEqual(['uncategorized', 'trash', 'apple', 'mango', 'Zebra']);
    });

    it("'added' keeps first-seen order", () => {
        expect(sortFolders(folders, { by: 'added' })).toEqual([
            'uncategorized',
            'trash',
            'Zebra',
            'apple',
            'mango',
        ]);
    });

    it("'count' is descending, ties broken alphabetically", () => {
        const counts = new Map([
            ['apple', 5],
            ['mango', 5],
            ['Zebra', 9],
        ]);
        expect(sortFolders(folders, { by: 'count', counts })).toEqual([
            'uncategorized',
            'trash',
            'Zebra',
            'apple',
            'mango',
        ]);
    });

    it("'count' with missing counts falls back to 0 then alpha", () => {
        expect(sortFolders(folders, { by: 'count' })).toEqual([
            'uncategorized',
            'trash',
            'apple',
            'mango',
            'Zebra',
        ]);
    });

    it('omits a reserved name that is not in folders', () => {
        expect(sortFolders(['trash', 'b', 'a'])).toEqual(['trash', 'a', 'b']);
    });

    it('does not mutate the input array', () => {
        const input = ['uncategorized', 'trash', 'c', 'a', 'b'];
        sortFolders(input);
        expect(input).toEqual(['uncategorized', 'trash', 'c', 'a', 'b']);
    });
});

describe('applyCountDelta', () => {
    it('adds new labels, decrements dropped ones, deletes at zero', () => {
        const counts = new Map([
            ['a', 2],
            ['b', 1],
        ]);
        applyCountDelta(counts, new Set(['a', 'b']), new Set(['a', 'c']));
        expect(Object.fromEntries(counts)).toEqual({ a: 2, c: 1 }); // b 1->0 deleted
    });
    it('a trash-exclusive swap: many labels out, trash in', () => {
        const counts = new Map([
            ['x', 1],
            ['y', 1],
            ['trash', 3],
        ]);
        applyCountDelta(counts, new Set(['x', 'y']), new Set(['trash']));
        expect(Object.fromEntries(counts)).toEqual({ trash: 4 });
    });
    it('no-op when the set is unchanged', () => {
        const counts = new Map([['a', 5]]);
        applyCountDelta(counts, new Set(['a']), new Set(['a']));
        expect(counts.get('a')).toBe(5);
    });
    it('accepts plain iterables, not just Sets', () => {
        const counts = new Map();
        applyCountDelta(counts, [], ['a', 'a', 'b']); // duplicate 'a' counted once (Set semantics)
        expect(Object.fromEntries(counts)).toEqual({ a: 1, b: 1 });
    });
});
