import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { IMAGE_EXTENSIONS, isImageFile, parseArgs, collectFromDir } from '../lib/scan.js';

describe('isImageFile', () => {
    it('matches known extensions, case-insensitively', () => {
        expect(isImageFile('a.jpg')).toBe(true);
        expect(isImageFile('A.JPG')).toBe(true);
        expect(isImageFile('x/y/Photo.PnG')).toBe(true);
        expect([...IMAGE_EXTENSIONS]).toContain('.webp');
    });
    it('rejects non-images', () => {
        expect(isImageFile('notes.txt')).toBe(false);
        expect(isImageFile('.imgsort-session.json')).toBe(false);
        expect(isImageFile('README')).toBe(false);
    });
});

describe('parseArgs', () => {
    it('defaults', () => {
        const a = parseArgs(['photos']);
        expect(a).toMatchObject({
            recursive: false,
            outDir: '.',
            followSymlinks: false,
            singleKeyAdvance: false,
            noSingleStoreUnchanged: false,
            focusMode: 'hotkeys',
            keepUncategorized: false,
            sessionEnabled: true,
            help: false,
            error: '',
            positionals: ['photos'],
            explicit: [],
        });
    });

    it('tracks which pref flags were explicitly passed (explicit[])', () => {
        expect(parseArgs(['d']).explicit).toEqual([]);
        expect(parseArgs(['-r', '--follow-symlinks', 'd']).explicit).toEqual([]);
        expect(parseArgs(['--hotkey-focus', 'd']).explicit).toContain('focusMode');
        expect(parseArgs(['--omnibar-focus', 'd']).explicit).toContain('focusMode');
        expect(parseArgs(['--single-key-advance', 'd']).explicit).toContain('singleKeyAdvance');
        expect(parseArgs(['--no-single-key-advance', 'd']).explicit).toContain('singleKeyAdvance');
        expect(parseArgs(['--keep-uncategorized', 'd']).explicit).toContain('keepUncategorized');
        expect(parseArgs(['--no-single-store-unchanged', 'd']).explicit).toContain(
            'noSingleStoreUnchanged'
        );
        expect(parseArgs(['--no-session', 'd']).explicit).toContain('sessionEnabled');
        expect(parseArgs(['--out', 'x', 'd']).explicit).toContain('out');
        expect(parseArgs(['--out=x', 'd']).explicit).toContain('out');
        const all = parseArgs([
            '--out=x',
            '--hotkey-focus',
            '--single-key-advance',
            '--keep-uncategorized',
            '--no-single-store-unchanged',
            '--no-session',
            'd',
        ]).explicit;
        expect(new Set(all)).toEqual(
            new Set([
                'out',
                'focusMode',
                'singleKeyAdvance',
                'keepUncategorized',
                'noSingleStoreUnchanged',
                'sessionEnabled',
            ])
        );
    });

    it('parses every flag, order-independently', () => {
        const a = parseArgs([
            '--hotkey-focus',
            '-r',
            'dir',
            '--no-session',
            '--single-key-advance',
            '--follow-symlinks',
            '--keep-uncategorized',
            '--no-single-store-unchanged',
        ]);
        expect(a).toMatchObject({
            recursive: true,
            followSymlinks: true,
            singleKeyAdvance: true,
            noSingleStoreUnchanged: true,
            focusMode: 'hotkeys',
            keepUncategorized: true,
            sessionEnabled: false,
            positionals: ['dir'],
            error: '',
        });
    });

    it('focus mode defaults to hotkeys; --omnibar-focus flips it; the pair resets', () => {
        expect(parseArgs(['d']).focusMode).toBe('hotkeys');
        expect(parseArgs(['--omnibar-focus', 'd']).focusMode).toBe('omnibar');
        expect(parseArgs(['--omnibar-focus', '--hotkey-focus', 'd']).focusMode).toBe('hotkeys');
        const a = parseArgs(['--single-key-advance', '--no-single-key-advance', 'd']);
        expect(a.singleKeyAdvance).toBe(false);
    });

    it('accepts --out <v> and --out=v', () => {
        expect(parseArgs(['--out', 'sorted', 'd']).outDir).toBe('sorted');
        expect(parseArgs(['--out=sorted', 'd']).outDir).toBe('sorted');
    });

    it('reports a missing --out value', () => {
        expect(parseArgs(['d', '--out']).error).toMatch(/--out requires/);
    });

    it('reports unknown options', () => {
        expect(parseArgs(['--bogus', 'd']).error).toMatch(/Unknown option: --bogus/);
    });

    it('reports missing / extra positionals', () => {
        expect(parseArgs([]).error).toMatch(/required/);
        expect(parseArgs(['a', 'b']).error).toMatch(/only one/);
    });

    it('-h / --help sets help and suppresses the positional error', () => {
        expect(parseArgs(['-h']).help).toBe(true);
        expect(parseArgs(['-h']).error).toBe('');
        expect(parseArgs(['--help', 'a', 'b']).help).toBe(true);
    });
});

describe('collectFromDir', () => {
    /** @type {string} */
    let root;
    /** @type {string} */
    let real;
    /** @type {string} */
    let ext;

    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'imgsort-scan-'));
        real = fs.realpathSync(root);
        fs.writeFileSync(path.join(root, 'top.JPG'), '');
        fs.writeFileSync(path.join(root, 'ignore.txt'), '');
        fs.mkdirSync(path.join(root, 'a', 'b'), { recursive: true });
        fs.writeFileSync(path.join(root, 'a', 'photo.png'), '');
        fs.writeFileSync(path.join(root, 'a', 'b', 'deep.gif'), '');

        // a symlinked file, a symlinked dir pointing OUTSIDE the tree, a self-loop
        fs.writeFileSync(path.join(root, 'target.webp'), '');
        fs.symlinkSync(path.join(root, 'target.webp'), path.join(root, 'link.webp'));
        ext = fs.mkdtempSync(path.join(os.tmpdir(), 'imgsort-ext-'));
        fs.writeFileSync(path.join(ext, 'e.png'), '');
        fs.symlinkSync(ext, path.join(root, 'ext-link'));
        fs.symlinkSync(root, path.join(root, 'loop'));
    });

    afterAll(() => {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(ext, { recursive: true, force: true });
    });

    it('top level only, no recursion', () => {
        const got = collectFromDir(root, {
            recurse: false,
            follow: false,
            baseReal: real,
            rootPosix: '',
        }).map(x => x.path);
        expect(got.sort()).toEqual(['target.webp', 'top.JPG']);
    });

    it('recurses and derives categories from parent dirs', () => {
        const got = collectFromDir(root, {
            recurse: true,
            follow: false,
            baseReal: real,
            rootPosix: '',
        });
        const byPath = Object.fromEntries(got.map(x => [x.path, x.category]));
        expect(byPath['top.JPG']).toBe('');
        expect(byPath['a/photo.png']).toBe('a');
        expect(byPath['a/b/deep.gif']).toBe('a/b');
    });

    it('applies the rootPosix served-path prefix', () => {
        const got = collectFromDir(root, {
            recurse: false,
            follow: false,
            baseReal: real,
            rootPosix: 'pics',
        }).map(x => x.path);
        expect(got).toContain('pics/top.JPG');
    });

    it('ignores symlinks by default', () => {
        const got = collectFromDir(root, {
            recurse: true,
            follow: false,
            baseReal: real,
            rootPosix: '',
        }).map(x => x.path);
        expect(got).not.toContain('link.webp');
        expect(got.some(p => p.startsWith('ext-link/'))).toBe(false);
    });

    it('follows symlinks (file by realpath, dir descended) with loop guard', () => {
        const got = collectFromDir(root, {
            recurse: true,
            follow: true,
            baseReal: real,
            rootPosix: '',
        }).map(x => x.path);
        // symlinked file resolves to its realpath (a plain top-level name here)
        expect(got).toContain('target.webp');
        // symlinked dir 'ext-link' -> descended; file served from its realpath
        expect(got.some(p => p.endsWith('/e.png'))).toBe(true);
        // the self-loop did not blow the stack / duplicate infinitely
        expect(got.filter(p => p === 'top.JPG').length).toBe(1);
    });
});
