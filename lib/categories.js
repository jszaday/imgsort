/** Reserved category names that always exist and cannot be user-created. */
export const RESERVED = ['uncategorized', 'trash'];

/** Cap on total categories: 9 digit keys + 26 letter keys. */
export const MAX_FOLDERS = 35;

/**
 * Toggle a category in an image's set, returning a NEW set. `trash` is
 * exclusive: adding it clears everything else; adding any real category
 * removes `trash`. Removing the last member falls back to {'uncategorized'}.
 *
 * With `clearUncategorized` (default), adding any category other than the exact
 * name `'uncategorized'` also drops `'uncategorized'` — it behaves as a default
 * bucket that empties itself once a real label lands.
 *
 * @param {Iterable<string>} set
 * @param {string} name
 * @param {{ clearUncategorized?: boolean }} [opts]
 * @returns {Set<string>}
 */
export function applyToggle(set, name, opts = {}) {
    const clearUncategorized = opts.clearUncategorized !== false;
    const s = new Set(set);
    if (s.has(name)) {
        s.delete(name);
        return s.size === 0 ? new Set(['uncategorized']) : s;
    }
    if (name === 'trash') return new Set(['trash']);
    s.delete('trash');
    if (clearUncategorized && name !== 'uncategorized') s.delete('uncategorized');
    s.add(name);
    return s;
}

/**
 * Why `name` can't become a new category given `folders`, or '' if it can.
 * @param {string} name
 * @param {string[]} folders
 * @returns {string}
 */
export function newCategoryError(name, folders) {
    if (name === '') return 'Folder name cannot be empty.';
    if (name.includes('/') || name.includes('\\')) {
        return 'Folder name cannot contain "/" or "\\".';
    }
    if (RESERVED.includes(name)) return `"${name}" is a reserved folder name.`;
    if (folders.includes(name)) return `Folder "${name}" already exists.`;
    if (folders.length >= MAX_FOLDERS) return `Maximum of ${MAX_FOLDERS} folders reached.`;
    return '';
}

/**
 * @param {string} name
 * @param {string[]} folders
 * @returns {boolean}
 */
export function isValidNewCategory(name, folders) {
    return newCategoryError(name, folders) === '';
}

/**
 * The keyboard key for the nth category: '1'..'9' then 'a', 'b', …
 * @param {number} i
 * @returns {string}
 */
export function folderKey(i) {
    return i < 9 ? String(i + 1) : String.fromCharCode(97 + (i - 9));
}

/**
 * Badge text for the nth category's key: a digit, or an uppercase letter.
 * @param {number} i
 * @param {boolean} [isMac] - reserved for platform-specific badges; unused today
 * @returns {string}
 */
export function folderKeyBadge(i, isMac) {
    void isMac;
    return folderKey(i).toUpperCase();
}

/**
 * Order category names for display. `uncategorized` then `trash` are always
 * pinned first (when present); the rest are ordered by `by`:
 *   'alpha' (default) — case-insensitive localeCompare
 *   'added'           — keep `folders`' existing relative order (first-seen)
 *   'count'           — descending by counts, ties broken alphabetically
 * `folders` itself is never mutated.
 * @param {string[]} folders
 * @param {{ by?: 'alpha' | 'added' | 'count', counts?: Map<string, number> }} [opts]
 * @returns {string[]}
 */
export function sortFolders(folders, opts = {}) {
    const by = opts.by || 'alpha';
    const counts = opts.counts || new Map();
    const pinned = RESERVED.filter(n => folders.includes(n));
    const rest = folders.filter(n => !RESERVED.includes(n));
    /** @param {string} a @param {string} b */
    const alpha = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());
    if (by === 'alpha') {
        rest.sort(alpha);
    } else if (by === 'count') {
        rest.sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || alpha(a, b));
    }
    // 'added' keeps `rest`'s existing order
    return [...pinned, ...rest];
}

/**
 * Count how many sets contain each label (booru-style per-label totals).
 * @param {Iterable<Iterable<string>>} sets
 * @returns {Map<string, number>}
 */
export function countLabels(sets) {
    /** @type {Map<string, number>} */
    const counts = new Map();
    for (const set of sets) {
        for (const name of set) counts.set(name, (counts.get(name) || 0) + 1);
    }
    return counts;
}

/**
 * Mutate `counts` by the difference between one image's old and new label sets.
 * A count that hits 0 is deleted. Returns `counts` for chaining.
 * @param {Map<string, number>} counts
 * @param {Iterable<string>} oldSet
 * @param {Iterable<string>} newSet
 * @returns {Map<string, number>}
 */
export function applyCountDelta(counts, oldSet, newSet) {
    const before = oldSet instanceof Set ? oldSet : new Set(oldSet);
    const after = newSet instanceof Set ? newSet : new Set(newSet);
    for (const name of before) {
        if (after.has(name)) continue;
        const n = (counts.get(name) || 0) - 1;
        if (n > 0) counts.set(name, n);
        else counts.delete(name);
    }
    for (const name of after) {
        if (!before.has(name)) counts.set(name, (counts.get(name) || 0) + 1);
    }
    return counts;
}
