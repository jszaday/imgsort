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

const USAGE = 'Usage: node server.js [-r|--recursive] [-h|--help] <directory|glob>';

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
            '  -h, --help         Show this help and exit.',
            '',
            'Examples:',
            '  node server.js ./photos                 # top level of ./photos',
            '  node server.js -r ./photos             # ./photos and all subdirectories',
            '  node server.js "**/*.{jpg,jpeg,png}"  # glob (quote to protect from the shell)',
            '',
            `Then open http://localhost:${PORT}`,
        ].join('\n')
    );
}

// Parse command line arguments
const argv = process.argv.slice(2);
let recursive = false;
/** @type {string[]} */
const positionals = [];
for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
        printHelp();
        process.exit(0);
    } else if (arg === '-r' || arg === '--recursive') {
        recursive = true;
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
 * @param {string} root
 * @param {boolean} recurse
 * @returns {string[]} paths relative to root, POSIX-normalized
 */
function collectFromDir(root, recurse) {
    /** @type {string[]} */
    const out = [];
    /** @param {string} rel */
    const walk = rel => {
        const abs = rel === '' ? root : path.join(root, rel);
        const entries = fs.readdirSync(abs, { withFileTypes: true });
        for (const entry of entries) {
            const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
            if (entry.isDirectory()) {
                if (recurse) walk(childRel);
            } else if (entry.isFile() && isImageFile(entry.name)) {
                out.push(childRel);
            }
        }
    };
    walk('');
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
            const rootRel = path.relative(fs.realpathSync(baseDir), fs.realpathSync(inputArg));
            const rootPosix = rootRel.split(path.sep).join('/');
            console.log(`Scanning directory: ${inputArg}${recursive ? ' (recursive)' : ''}`);
            const rels = collectFromDir(path.resolve(inputArg), recursive);
            imageFiles = rels.map(rel => (rootPosix ? `${rootPosix}/${rel}` : rel));

            if (recursive) {
                rels.forEach((rel, i) => {
                    const dir = path.posix.dirname(rel);
                    if (dir && dir !== '.') {
                        imageCategories[imageFiles[i]] = dir;
                    }
                });
            }
        } else {
            console.log(`Searching for images matching: ${inputArg}`);
            const files = await glob(inputArg, {
                nodir: true,
                absolute: false,
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
        res.end(JSON.stringify({ images: imageFiles, categories: imageCategories }));
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
