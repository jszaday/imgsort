#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { glob } from 'glob';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';
import { hash8 } from './lib/hash.js';
import { IMAGE_EXTENSIONS, isImageFile, parseArgs, collectFromDir } from './lib/scan.js';

const SESSION_FILE = '.imgsort-session.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;
/** @type {string[]} */
let imageFiles = []; // Paths relative to baseDir
/** @type {{ [path: string]: string }} */
let imageCategories = {}; // Only entries whose category !== 'uncategorized'
let baseDir = '';

const USAGE =
    'Usage: node server.js [-r|--recursive] [--out <dir>] [--follow-symlinks] ' +
    '[--single-key-advance|--no-single-key-advance] [--no-single-store-unchanged] ' +
    '[--omnibar-focus|--hotkey-focus] [--no-session] [-h|--help] <directory|glob>';

function printUsage() {
    console.error(USAGE);
}

function printHelp() {
    const exts = [...IMAGE_EXTENSIONS].map(e => e.slice(1)).join(',');
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
            '  --omnibar-focus | --hotkey-focus',
            '                     Sorter-screen focus. --omnibar-focus (default): the',
            '                     category search box holds focus and grabs it on every',
            '                     image; type to fuzzy-find, Esc to release for hotkeys.',
            '                     --hotkey-focus: bare 1-9 / a-z keys drive it and "/"',
            '                     jumps to the search box. Switchable live in the UI.',
            '  --no-single-store-unchanged',
            '                     Leave an item untouched (no intern, no reference) when',
            '                     its category set is unchanged from -r discovery. Default:',
            '                     such items are interned and referenced like the rest.',
            '  --follow-symlinks  Follow symlinked files and directories while scanning',
            '                     (default: symlinks are ignored entirely). A symlinked',
            '                     file is interned by its realpath; symlink loops guarded.',
            '  --no-session       Disable the resumable session. By default every',
            `                     decision is autosaved to ${SESSION_FILE} in the`,
            '                     start directory (hidden dotfile) so you can resume,',
            '                     undo and redo; --no-session turns that off entirely.',
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

// Parse command line arguments (no exit here — acted on under the main guard).
const args = parseArgs(process.argv.slice(2));
const {
    recursive,
    outDir,
    noSingleStoreUnchanged,
    followSymlinks,
    singleKeyAdvance,
    focusMode,
    sessionEnabled,
    positionals,
} = args;
let imageSetHash = '';

const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;

if (isMain) {
    if (args.help) {
        printHelp();
        process.exit(0);
    }
    if (args.error) {
        console.error(args.error);
        printUsage();
        process.exit(1);
    }
}

const inputArg = positionals[0];

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
            const items = collectFromDir(path.resolve(inputArg), {
                recurse: recursive,
                follow: followSymlinks,
                baseReal,
                rootPosix,
            });
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

        imageSetHash = hash8([...imageFiles].sort().join('\n'));

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
                options: {
                    out: outDir,
                    noSingleStoreUnchanged,
                    singleKeyAdvance,
                    focusMode,
                    sessionEnabled,
                    imageSetHash,
                },
            })
        );
        return;
    }

    // Resumable-session transaction log (single latest file in baseDir).
    if (req.url === '/session') {
        res.setHeader('Content-Type', 'application/json');

        if (!sessionEnabled) {
            res.writeHead(200);
            res.end(JSON.stringify({ disabled: true }));
            return;
        }

        const sessionPath = path.join(baseDir, SESSION_FILE);

        if (req.method === 'GET') {
            let data = {};
            try {
                data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
            } catch {
                data = {};
            }
            res.writeHead(200);
            res.end(JSON.stringify(data));
            return;
        }

        if (req.method === 'DELETE') {
            try {
                fs.unlinkSync(sessionPath);
            } catch (err) {
                const code = err && typeof err === 'object' && 'code' in err ? err.code : undefined;
                if (code !== 'ENOENT') {
                    res.writeHead(200);
                    res.end(
                        JSON.stringify({
                            ok: false,
                            error: err instanceof Error ? err.message : String(err),
                        })
                    );
                    return;
                }
            }
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    fs.writeFileSync(sessionPath, JSON.stringify(parsed, null, 2));
                    if (process.platform === 'win32') {
                        execFile('attrib', ['+h', sessionPath], () => {});
                    }
                    res.writeHead(200);
                    res.end(JSON.stringify({ ok: true }));
                } catch (err) {
                    res.writeHead(200);
                    res.end(
                        JSON.stringify({
                            ok: false,
                            error: err instanceof Error ? err.message : String(err),
                        })
                    );
                }
            });
            return;
        }

        res.writeHead(405);
        res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
        return;
    }

    // Serve the extracted pure-logic ES modules to the browser.
    if (req.url && req.url.startsWith('/lib/')) {
        const name = req.url.slice('/lib/'.length);
        if (name.includes('/') || name.includes('..') || !name.endsWith('.js')) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        fs.readFile(path.join(__dirname, 'lib', name), (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/javascript' });
            res.end(data);
        });
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

// Start the server only when run directly (not when imported by tests).
if (isMain) {
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
}
