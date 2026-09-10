import { describe, it, expect } from 'vitest';
import { buildOps, lowerPosix, lowerWindows, shquote, psquote, refKey } from '../lib/script.js';

const STORE = '.imgsort-store-20260101-000000-uuuu';

/**
 * @param {Object} o
 * @param {string[]} o.images
 * @param {string[]} o.folders
 * @param {Record<string, string[]>} o.assign  path -> categories
 * @param {Record<string, string>} [o.discovered]
 * @param {string[]} [o.checked]  refKeys to check; defaults to every (cat,path) pair
 * @param {string} [o.out]
 * @param {boolean} [o.noSingleStoreUnchanged]
 */
function state(o) {
    const assignments = new Map(
        o.images.map(img => [img, new Set(o.assign[img] || ['uncategorized'])])
    );
    let checked = o.checked;
    if (!checked) {
        checked = [];
        for (const img of o.images) {
            for (const c of o.assign[img] || ['uncategorized']) checked.push(refKey(c, img));
        }
    }
    return {
        images: o.images,
        folders: o.folders,
        assignments,
        discovered: o.discovered || {},
        checkedRefs: new Set(checked),
        out: o.out || '.',
        storeName: STORE,
        noSingleStoreUnchanged: !!o.noSingleStoreUnchanged,
    };
}

describe('shquote / psquote', () => {
    it('shquote wraps and escapes single quotes the POSIX way', () => {
        expect(shquote('plain')).toBe("'plain'");
        expect(shquote("a'b")).toBe("'a'\\''b'");
    });
    it('psquote doubles single quotes', () => {
        expect(psquote("a'b")).toBe("'a''b'");
    });
});

describe('buildOps', () => {
    it('interns an item once even when it is in several categories', () => {
        const ops = buildOps(
            state({
                images: ['p/x.png'],
                folders: ['uncategorized', 'trash', 'a', 'b'],
                assign: { 'p/x.png': ['a', 'b'] },
            })
        );
        const interns = ops.filter(o => o.op === 'intern');
        expect(interns).toHaveLength(1);
        const refs = ops.filter(o => o.op === 'reference');
        expect(refs.map(r => r.category).sort()).toEqual(['a', 'b']);
    });

    it('store-name collisions get an <hash8>- prefix', () => {
        const ops = buildOps(
            state({
                images: ['one/x.png', 'two/x.png'],
                folders: ['uncategorized', 'trash', 'a'],
                assign: { 'one/x.png': ['a'], 'two/x.png': ['a'] },
            })
        );
        const names = ops.filter(o => o.op === 'intern').map(o => o.name);
        expect(names[0]).toBe('x.png');
        expect(names[1]).toMatch(/^[0-9a-f]{8}-x\.png$/);
    });

    it('trash is interned but produces no reference op', () => {
        const ops = buildOps(
            state({
                images: ['x.png'],
                folders: ['uncategorized', 'trash'],
                assign: { 'x.png': ['trash'] },
            })
        );
        expect(ops.some(o => o.op === 'intern')).toBe(true);
        expect(ops.some(o => o.op === 'reference')).toBe(false);
    });

    it('noSingleStoreUnchanged skips an item still at its discovered category', () => {
        const ops = buildOps(
            state({
                images: ['x.png', 'y.png'],
                folders: ['uncategorized', 'trash', 'keep'],
                assign: { 'x.png': ['keep'], 'y.png': ['keep'] },
                discovered: { 'x.png': 'keep', 'y.png': 'uncategorized' },
                noSingleStoreUnchanged: true,
            })
        );
        const interned = ops.filter(o => o.op === 'intern').map(o => o.src);
        expect(interned).toEqual(['y.png']); // x.png left in place
    });

    it('returns [] when nothing is checked', () => {
        expect(
            buildOps(
                state({
                    images: ['x.png'],
                    folders: ['uncategorized', 'trash'],
                    assign: { 'x.png': ['uncategorized'] },
                    checked: [],
                })
            )
        ).toEqual([]);
    });
});

describe('lowerPosix', () => {
    const opts = { shebang: '#!/bin/sh', out: '.', storeName: STORE };

    it('emits "nothing to do" for an empty op list', () => {
        expect(lowerPosix([], opts)).toBe('#!/bin/sh\nset -e\n\n# nothing to do\n');
    });

    it('reference target climbs ../ once per category segment', () => {
        const ops = buildOps(
            state({
                images: ['src.png'],
                folders: ['uncategorized', 'trash', 'a/b/c'],
                assign: { 'src.png': ['a/b/c'] },
            })
        );
        const script = lowerPosix(ops, opts);
        expect(script).toContain(`ln -nfs '../../../${STORE}/src.png' '${'a/b/c'}/src.png'`);
    });

    it('loudly echoes each intern before moving it', () => {
        const ops = buildOps(
            state({
                images: ['d/x.png'],
                folders: ['uncategorized', 'trash', 'a'],
                assign: { 'd/x.png': ['a'] },
            })
        );
        const script = lowerPosix(ops, opts);
        expect(script).toContain(`echo 'interning into single store: ./d/x.png -> ${STORE}/x.png'`);
        expect(script).toContain(`mv -i './d/x.png' '${STORE}/x.png'`);
    });

    it('shell-escapes a name containing a quote', () => {
        const ops = buildOps(
            state({
                images: ["it's.png"],
                folders: ['uncategorized', 'trash', 'a'],
                assign: { "it's.png": ['a'] },
            })
        );
        const script = lowerPosix(ops, opts);
        expect(script).toContain("mv -i './it'\\''s.png'");
    });

    it('honours --out as a path prefix', () => {
        const ops = buildOps(
            state({
                images: ['x.png'],
                folders: ['uncategorized', 'trash', 'a'],
                assign: { 'x.png': ['a'] },
                out: 'sorted',
            })
        );
        const script = lowerPosix(ops, { ...opts, out: 'sorted' });
        expect(script).toContain(`mkdir -p 'sorted/${STORE}'`);
        expect(script).toContain(`ln -nfs '../${STORE}/x.png' 'sorted/a/x.png'`);
    });
});

describe('lowerWindows', () => {
    const opts = { out: '.', storeName: STORE };

    it('emits "nothing to do" for an empty op list', () => {
        expect(lowerWindows([], opts)).toBe("$ErrorActionPreference = 'Stop'\n\n# nothing to do\n");
    });

    it('creates a .lnk via WScript.Shell with an absolute Join-Path target', () => {
        const ops = buildOps(
            state({
                images: ['d/x.png'],
                folders: ['uncategorized', 'trash', 'a'],
                assign: { 'd/x.png': ['a'] },
            })
        );
        const script = lowerWindows(ops, opts);
        expect(script).toContain('$ws = New-Object -ComObject WScript.Shell');
        // link lives under <out>/<category>, target is the absolute store path
        expect(script).toContain("$s = $ws.CreateShortcut((Join-Path $root 'a\\x.png.lnk'))");
        expect(script).toContain(`$s.TargetPath = (Join-Path $root '${STORE}\\x.png')`);
        expect(script).toContain('$s.Save()');
    });

    it('marks the store dir Hidden and uses backslash paths', () => {
        const ops = buildOps(
            state({
                images: ['d/x.png'],
                folders: ['uncategorized', 'trash', 'a'],
                assign: { 'd/x.png': ['a'] },
            })
        );
        const script = lowerWindows(ops, opts);
        expect(script).toContain(`(Get-Item '${STORE}').Attributes += 'Hidden'`);
        expect(script).toContain(
            `Move-Item -LiteralPath '.\\d\\x.png' -Destination '${STORE}\\x.png'`
        );
    });

    it('psquote doubles a quote in a PowerShell literal path', () => {
        const ops = buildOps(
            state({
                images: ["a'b/x.png"],
                folders: ['uncategorized', 'trash', "a'b"],
                assign: { "a'b/x.png": ["a'b"] },
            })
        );
        const script = lowerWindows(ops, opts);
        expect(script).toContain("Move-Item -LiteralPath '.\\a''b\\x.png'");
    });
});
