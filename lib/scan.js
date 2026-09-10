import fs from 'fs';
import path from 'path';

/** Supported image extensions (lowercase, with dot). */
export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']);

/**
 * @param {string} filename
 * @returns {boolean}
 */
export function isImageFile(filename) {
    return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

/**
 * @typedef {Object} ParsedArgs
 * @property {boolean} recursive
 * @property {string} outDir
 * @property {boolean} followSymlinks
 * @property {boolean} singleKeyAdvance
 * @property {boolean} noSingleStoreUnchanged
 * @property {'omnibar' | 'hotkeys'} focusMode - default 'hotkeys'; --omnibar-focus flips it
 * @property {boolean} keepUncategorized - default false; --keep-uncategorized keeps it sticky
 * @property {boolean} sessionEnabled
 * @property {string[]} positionals
 * @property {boolean} help
 * @property {string} error - non-empty on a parse problem; '' otherwise
 */

/**
 * Parse the CLI argv (order-independent). Never exits — the caller acts on
 * `help` / `error`.
 * @param {string[]} argv
 * @returns {ParsedArgs}
 */
export function parseArgs(argv) {
    /** @type {ParsedArgs} */
    const out = {
        recursive: false,
        outDir: '.',
        followSymlinks: false,
        singleKeyAdvance: false,
        noSingleStoreUnchanged: false,
        focusMode: 'hotkeys',
        keepUncategorized: false,
        sessionEnabled: true,
        positionals: [],
        help: false,
        error: '',
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            out.help = true;
        } else if (arg === '-r' || arg === '--recursive') {
            out.recursive = true;
        } else if (arg === '--out') {
            const value = argv[++i];
            if (value === undefined) {
                out.error = '--out requires a directory argument';
                return out;
            }
            out.outDir = value;
        } else if (arg.startsWith('--out=')) {
            out.outDir = arg.slice('--out='.length);
        } else if (arg === '--no-single-store-unchanged') {
            out.noSingleStoreUnchanged = true;
        } else if (arg === '--follow-symlinks') {
            out.followSymlinks = true;
        } else if (arg === '--single-key-advance') {
            out.singleKeyAdvance = true;
        } else if (arg === '--no-single-key-advance') {
            out.singleKeyAdvance = false;
        } else if (arg === '--omnibar-focus') {
            out.focusMode = 'omnibar';
        } else if (arg === '--hotkey-focus') {
            out.focusMode = 'hotkeys';
        } else if (arg === '--no-session') {
            out.sessionEnabled = false;
        } else if (arg === '--keep-uncategorized') {
            out.keepUncategorized = true;
        } else if (arg.startsWith('-') && arg !== '-') {
            out.error = `Unknown option: ${arg}`;
            return out;
        } else {
            out.positionals.push(arg);
        }
    }

    if (!out.help && out.positionals.length !== 1) {
        out.error =
            out.positionals.length === 0
                ? 'a <directory|glob> argument is required'
                : 'only one <directory|glob> argument is allowed';
    }
    return out;
}

/**
 * Recursively (or not) collect image files under a directory.
 *
 * `follow` false (default): symlink entries are ignored entirely. `follow`
 * true: a symlinked file is collected by its realpath and a symlinked dir is
 * descended (with `recurse`), guarding against symlink loops via visited
 * realpaths.
 *
 * @param {string} root
 * @param {{ recurse: boolean, follow: boolean, baseReal: string, rootPosix: string }} opts
 * @returns {{ path: string, category: string }[]} served path + discovered category
 */
export function collectFromDir(root, opts) {
    const { recurse, follow, baseReal, rootPosix } = opts;
    /** @type {{ path: string, category: string }[]} */
    const out = [];
    /** @type {Set<string>} */
    const visited = new Set([fs.realpathSync(root)]);

    /** @param {string} rel */
    const catOf = rel => {
        const dir = path.posix.dirname(rel);
        return dir === '.' ? '' : dir;
    };
    /** @param {string} rel */
    const served = rel => (rootPosix ? `${rootPosix}/${rel}` : rel);

    /**
     * @param {string} abs
     * @param {string} rel
     */
    const walk = (abs, rel) => {
        const entries = fs.readdirSync(abs, { withFileTypes: true });
        for (const entry of entries) {
            const childAbs = path.join(abs, entry.name);
            const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
            const isSymlink = entry.isSymbolicLink();
            let isDir = entry.isDirectory();
            let isFile = entry.isFile();

            if (isSymlink) {
                if (!follow) continue; // default: ignore symlinks entirely
                try {
                    const st = fs.statSync(childAbs); // follows the link
                    isDir = st.isDirectory();
                    isFile = st.isFile();
                } catch {
                    continue; // broken link
                }
            }

            if (isDir) {
                if (!recurse) continue;
                let real;
                try {
                    real = fs.realpathSync(childAbs);
                } catch {
                    continue;
                }
                if (visited.has(real)) continue; // symlink-loop guard
                visited.add(real);
                walk(childAbs, childRel);
            } else if (isFile && isImageFile(entry.name)) {
                if (isSymlink) {
                    try {
                        const real = fs.realpathSync(childAbs);
                        out.push({
                            path: path.relative(baseReal, real).split(path.sep).join('/'),
                            category: catOf(childRel),
                        });
                    } catch {
                        continue;
                    }
                } else {
                    out.push({ path: served(childRel), category: catOf(childRel) });
                }
            }
        }
    };
    walk(root, '');
    return out;
}
