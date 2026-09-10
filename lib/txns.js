import { MAX_FOLDERS, applyToggle, newCategoryError } from './categories.js';

/**
 * @typedef {{ t: 'toggle', image: string, category: string }
 *   | { t: 'set', image: string, categories: string[] }
 *   | { t: 'create', name: string, image: string }} Txn
 */

/**
 * @typedef {{ images: string[], discovered: Record<string, string> }} ReplayBase
 */

/**
 * Fold a transaction log onto the discovered base to derive the current sort.
 * Path-keyed (index-independent). `create` re-adds the folder (if valid) and
 * applies it; `toggle` / `set` are skipped when their image is absent or (for a
 * folder ref) the folder is gone; a `create` whose image is absent is skipped
 * whole (folder not re-added). Discovered categories keep first-seen order
 * after the reserved pair.
 *
 * @param {ReplayBase} base
 * @param {Txn[]} txns
 * @returns {{ folders: string[], assignments: Map<string, Set<string>> }}
 */
export function replay(base, txns) {
    const images = base.images || [];
    const discovered = base.discovered || {};

    const folders = ['uncategorized', 'trash'];
    for (const img of images) {
        const c = discovered[img] || 'uncategorized';
        if (c !== 'uncategorized' && !folders.includes(c)) folders.push(c);
    }

    /** @type {Map<string, Set<string>>} */
    const assignments = new Map();
    for (const img of images) {
        assignments.set(img, new Set([discovered[img] || 'uncategorized']));
    }

    const present = new Set(images);

    for (const tx of txns || []) {
        if (tx.t === 'create') {
            if (!present.has(tx.image)) continue; // image gone -> drop the whole create
            if (
                !folders.includes(tx.name) &&
                folders.length < MAX_FOLDERS &&
                newCategoryError(tx.name, folders) === ''
            ) {
                folders.push(tx.name);
            }
            if (folders.includes(tx.name)) {
                assignments.set(tx.image, applyToggle(assignments.get(tx.image) || [], tx.name));
            }
        } else if (tx.t === 'toggle') {
            if (present.has(tx.image) && folders.includes(tx.category)) {
                assignments.set(
                    tx.image,
                    applyToggle(assignments.get(tx.image) || [], tx.category)
                );
            }
        } else if (tx.t === 'set') {
            if (!present.has(tx.image)) continue;
            const cats = (tx.categories || []).filter(c => folders.includes(c));
            if (cats.length) assignments.set(tx.image, new Set(cats));
        }
    }

    return { folders, assignments };
}
