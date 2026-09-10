/** Reserved category names that always exist and cannot be user-created. */
export const RESERVED = ['uncategorized', 'trash'];

/** Cap on total categories: 9 digit keys + 26 letter keys. */
export const MAX_FOLDERS = 35;

/**
 * Toggle a category in an image's set, returning a NEW set. `trash` is
 * exclusive: adding it clears everything else; adding any real category
 * removes `trash`. Removing the last member falls back to {'uncategorized'}.
 * @param {Iterable<string>} set
 * @param {string} name
 * @returns {Set<string>}
 */
export function applyToggle(set, name) {
    const s = new Set(set);
    if (s.has(name)) {
        s.delete(name);
        return s.size === 0 ? new Set(['uncategorized']) : s;
    }
    if (name === 'trash') return new Set(['trash']);
    s.delete('trash');
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
