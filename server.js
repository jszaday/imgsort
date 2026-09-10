#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;
/** @type {string[]} */
let imageFiles = []; // Paths relative to baseDir
/** @type {{ [path: string]: string }} */
let imageCategories = {}; // Only entries whose category !== 'uncategorized'
let baseDir = '';

// Supported image extensions
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']);

const USAGE =
    'Usage: node server.js [-r|--recursive] [--out <dir>] ' +
    '[--no-single-store-unchanged] [--follow-symlinks] [-h|--help] <directory|glob>';

function printUsage() {
    console.error(USAGE);
}

function printHelp() {
    const exts = [...imageExtensions].map(e => e.slice(1)).join(',');
    console.log(
        [
            'imgsort — local browser-based image-triage tool',
            '',
            USAGE,
            '',
            'Arguments:',
            '  <directory|glob>   An existing directory to scan for images, or a glob',
            '                     pattern (quoted). Image match is by extension,',
            `                     case-insensitive: ${exts}`,
            '',
            'Options:',
            '  -r, --recursive    When the argument is a directory, walk it recursively.',
            "                     With -r, each image's category is seeded from its",
            '                     parent directory relative to the given root.',
            '                     Ignored for glob arguments.',
            '  --out <dir>        Output root for the generated tree (single store plus',
            '                     category reference dirs). Default ".".',
            '  --single-key-advance | --no-single-key-advance',
            '                     Base advance mode for the sorter screen. A category',
            '                     key (1-9 / a-z) always toggles that category; this sets',
            '                     whether it then advances. --no-single-key-advance',
            '                     (default) = Manual (advance with Space / Down).',
            '                     --single-key-advance = Auto at the triage frontier,',
            '                     flipping to Manual when you go back to edit an earlier',
            '                     image. The on-screen Advance pill shows the effective',
            '                     mode and can pin it either way.',
            '  --no-single-store-unchanged',
            '                     Leave an item untouched (no intern, no reference) when',
            '                     its category set is unchanged from -r discovery. Default:',
            '                     such items are interned and referenced like the rest.',
            '  --follow-symlinks  Follow symlinked files and directories while scanning',
            '                     (default: symlinks are ignored entirely). A symlinked',
            '                     file is interned by its realpath; symlink loops guarded.',
            '  -h, --help         Show this help and exit.',
            '',
            'Examples:',
            '  node server.js ./photos                       # top level of ./photos',
            '  node server.js -r ./photos                    # ./photos and subdirectories',
            '  node server.js -r --out sorted ./photos       # write tree under ./sorted',
            '  node server.js --single-key-advance ./photos  # category key advances (Auto)',
            '  node server.js "**/*.{jpg,jpeg,png}"          # glob (quote it from the shell)',
            '',
            `Then open http://localhost:${PORT}`,
        ].join('\n')
    );
}

// Parse command line arguments
const argv = process.argv.slice(2);
let recursive = false;
let outDir = '.';
let noSingleStoreUnchanged = false;
let followSymlinks = false;
let singleKeyAdvance = false;
/** @type {string[]} */
const positionals = [];
for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
        printHelp();
        process.exit(0);
    } else if (arg === '-r' || arg === '--recursive') {
        recursive = true;
    } else if (arg === '--out') {
        const value = argv[++i];
        if (value === undefined) {
            console.error('--out requires a directory argument');
            printUsage();
            process.exit(1);
        }
        outDir = value;
    } else if (arg.startsWith('--out=')) {
        outDir = arg.slice('--out='.length);
    } else if (arg === '--no-single-store-unchanged') {
        noSingleStoreUnchanged = true;
    } else if (arg === '--follow-symlinks') {
        followSymlinks = true;
    } else if (arg === '--single-key-advance') {
        singleKeyAdvance = true;
    } else if (arg === '--no-single-key-advance') {
        singleKeyAdvance = false;
    } else if (arg.startsWith('-') && arg !== '-') {
        console.error(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    } else {
        positionals.push(arg);
    }
}

if (positionals.length !== 1) {
    printUsage();
    process.exit(1);
}

const inputArg = positionals[0];

/**
 * @param {string} filename
 * @returns {boolean}
 */
function isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.has(ext);
}

/**
 * Recursively (or not) collect image files under a directory.
 *
 * With followSymlinks=false (default) symlink entries are ignored entirely.
 * With followSymlinks=true a symlinked file is collected by its realpath and a
 * symlinked directory is descended (with -r), guarding against symlink loops.
 *
 * @param {string} root
 * @param {boolean} recurse
 * @param {boolean} follow
 * @param {string} baseReal - realpath of the directory served paths are relative to
 * @param {string} rootPosix - served-path prefix for files found under root (POSIX)
 * @returns {{ path: string, category: string }[]} served path + discovered category
 */
function collectFromDir(root, recurse, follow, baseReal, rootPosix) {
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

async function findImages() {
    try {
        baseDir = process.cwd();

        let isDir = false;
        try {
            isDir = fs.statSync(inputArg).isDirectory();
        } catch {
            isDir = false;
        }

        if (isDir) {
            const baseReal = fs.realpathSync(baseDir);
            const rootRel = path.relative(baseReal, fs.realpathSync(inputArg));
            const rootPosix = rootRel.split(path.sep).join('/');
            console.log(
                `Scanning directory: ${inputArg}${recursive ? ' (recursive)' : ''}` +
                    `${followSymlinks ? ' (following symlinks)' : ''}`
            );
            const items = collectFromDir(
                path.resolve(inputArg),
                recursive,
                followSymlinks,
                baseReal,
                rootPosix
            );
            imageFiles = items.map(it => it.path);

            if (recursive) {
                items.forEach(it => {
                    if (it.category) {
                        imageCategories[it.path] = it.category;
                    }
                });
            }
        } else {
            console.log(`Searching for images matching: ${inputArg}`);
            const files = await glob(inputArg, {
                nodir: true,
                absolute: false,
                follow: followSymlinks,
            });
            imageFiles = files.filter(isImageFile);
        }

        if (imageFiles.length === 0) {
            console.error('No images found.');
            process.exit(1);
        }

        console.log(`Found ${imageFiles.length} images`);
        console.log(`Starting server at http://localhost:${PORT}`);
        console.log('Press Ctrl+C to stop the server\n');
    } catch (error) {
        console.error(
            'Error finding images:',
            error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
    }
}

/** @type {{ [key: string]: string }} */
const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
};

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Serve the main HTML page
    if (req.url === '/' || req.url === '/index.html') {
        const htmlPath = path.join(__dirname, 'index.html');
        fs.readFile(htmlPath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading page');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    // API endpoint to get list of images (returns paths relative to baseDir)
    if (req.url === '/images') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                images: imageFiles,
                categories: imageCategories,
                options: { out: outDir, noSingleStoreUnchanged, singleKeyAdvance },
            })
        );
        return;
    }

    // Serve individual images
    if (req.url && req.url.startsWith('/image/')) {
        const requestedPath = decodeURIComponent(req.url.substring(7));

        // Security: ensure the requested file is in our (relative) image list
        if (!imageFiles.includes(requestedPath)) {
            res.writeHead(404);
            res.end('Image not found');
            return;
        }

        const absolutePath = path.resolve(baseDir, requestedPath);
        const ext = path.extname(requestedPath).toLowerCase();
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        fs.readFile(absolutePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Image not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(data);
        });
        return;
    }

    // 404 for everything else
    res.writeHead(404);
    res.end('Not found');
});

// Start the server
findImages().then(() => {
    server.listen(PORT, () => {
        console.log(`Open your browser and navigate to: http://localhost:${PORT}`);
    });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nShutting down server...');
    server.close(() => {
        console.log('Server closed');
    });
    // Force exit after a short delay if server hasn't closed
    setTimeout(() => {
        process.exit(0);
    }, 100);
});
