import { describe, it, expect } from 'vitest';
import { replay } from '../lib/txns.js';

/**
 * Identity helper: contextually types a literal array as Txn[] so the inline
 * `{ t: 'toggle', … }` objects narrow instead of widening to `{ t: string }`.
 * @param {import('../lib/txns.js').Txn[]} txns
 * @returns {import('../lib/txns.js').Txn[]}
 */
const T = txns => txns;

/** @param {ReturnType<typeof replay>} r @param {string} img */
const cats = (r, img) => [...(r.assignments.get(img) || [])].sort();

const base = {
    images: ['a.png', 'b.png', 'c.png'],
    discovered: { 'a.png': 'uncategorized', 'b.png': 'trip', 'c.png': 'uncategorized' },
};

describe('replay', () => {
    it('base only: reserved first, discovered in first-seen order', () => {
        const r = replay(base, []);
        expect(r.folders).toEqual(['uncategorized', 'trash', 'trip']);
        expect(cats(r, 'b.png')).toEqual(['trip']);
        expect(cats(r, 'a.png')).toEqual(['uncategorized']);
    });

    it('applies one toggle (clearing the default uncategorized bucket)', () => {
        const r = replay(base, T([{ t: 'toggle', image: 'a.png', category: 'trip' }]));
        expect(cats(r, 'a.png')).toEqual(['trip']);
    });

    it('clearUncategorized:false keeps uncategorized alongside the toggled label', () => {
        const r = replay(base, T([{ t: 'toggle', image: 'a.png', category: 'trip' }]), {
            clearUncategorized: false,
        });
        expect(cats(r, 'a.png')).toEqual(['trip', 'uncategorized']);
    });

    it('skips a txn flagged disabled (Actions tab) but still applies its neighbours', () => {
        const log = T([
            { t: 'toggle', image: 'a.png', category: 'trip', disabled: true },
            { t: 'toggle', image: 'c.png', category: 'trash' },
        ]);
        expect(cats(replay(base, log), 'a.png')).toEqual(['uncategorized']); // disabled -> not applied
        expect(cats(replay(base, log), 'c.png')).toEqual(['trash']);
        // clearing the flag re-applies it
        const enabled = T([{ ...log[0], disabled: false }, log[1]]);
        expect(cats(replay(base, enabled), 'a.png')).toEqual(['trip']);
    });

    it('undo path: popping the last txn and replaying reverts it', () => {
        const log = T([
            { t: 'toggle', image: 'a.png', category: 'trip' },
            { t: 'toggle', image: 'c.png', category: 'trash' },
        ]);
        expect(cats(replay(base, log), 'c.png')).toEqual(['trash']);
        expect(cats(replay(base, log.slice(0, -1)), 'c.png')).toEqual(['uncategorized']);
    });

    it('create re-adds the folder and applies it to its image', () => {
        const r = replay(base, T([{ t: 'create', name: 'faves', image: 'b.png' }]));
        expect(r.folders).toContain('faves');
        expect(cats(r, 'b.png')).toEqual(['faves', 'trip']);
    });

    it('skips a create whose image is absent (folder not re-added, nothing applied)', () => {
        const r = replay(base, T([{ t: 'create', name: 'faves', image: 'GONE.png' }]));
        expect(r.folders).not.toContain('faves');
        expect(cats(r, 'a.png')).toEqual(['uncategorized']);
    });

    it('skips a toggle for an absent folder', () => {
        const r = replay(base, T([{ t: 'toggle', image: 'a.png', category: 'ghost' }]));
        expect(cats(r, 'a.png')).toEqual(['uncategorized']);
    });

    it('skips a toggle for an absent image', () => {
        const r = replay(base, T([{ t: 'toggle', image: 'GONE.png', category: 'trip' }]));
        expect(r.assignments.has('GONE.png')).toBe(false);
    });

    it('applies a set, filtering categories that no longer exist', () => {
        const r = replay(
            base,
            T([
                { t: 'create', name: 'faves', image: 'a.png' },
                { t: 'set', image: 'a.png', categories: ['faves', 'ghost', 'trip'] },
            ])
        );
        expect(cats(r, 'a.png')).toEqual(['faves', 'trip']);
    });

    it('trash exclusivity survives a replay', () => {
        const r = replay(
            base,
            T([
                { t: 'toggle', image: 'b.png', category: 'trash' }, // clears 'trip'
                { t: 'toggle', image: 'b.png', category: 'trip' }, // clears 'trash'
            ])
        );
        expect(cats(r, 'b.png')).toEqual(['trip']);
    });

    it('preserves discovered order ahead of created categories', () => {
        const b2 = {
            images: ['x/1.png', 'y/1.png'],
            discovered: { 'x/1.png': 'x', 'y/1.png': 'y' },
        };
        const r = replay(b2, T([{ t: 'create', name: 'aaa', image: 'x/1.png' }]));
        expect(r.folders).toEqual(['uncategorized', 'trash', 'x', 'y', 'aaa']);
    });
});
