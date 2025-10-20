#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const PORT = 3000;
let imageFiles = []; // Relative paths
let absoluteImagePaths = []; // Absolute paths for display
let baseDir = '';

// Get glob pattern from command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node server.js <glob-pattern>');
    console.error('Example: node server.js "**/*.{jpg,jpeg,png,gif,webp}"');
    console.error('Example: node server.js "./photos/**/*.jpg"');
    process.exit(1);
}

const globPattern = args[0];

// Supported image extensions
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']);

function isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.has(ext);
}

async function findImages() {
    try {
        console.log(`Searching for images matching: ${globPattern}`);

        const files = await glob(globPattern, {
            nodir: true,
            absolute: false,
        });

        imageFiles = files.filter(isImageFile);

        if (imageFiles.length === 0) {
            console.error('No images found matching the pattern.');
            process.exit(1);
        }

        // Store the base directory for serving files
        baseDir = process.cwd();

        // Create absolute paths for display
        absoluteImagePaths = imageFiles.map(file => path.resolve(baseDir, file));

        console.log(`Found ${imageFiles.length} images`);
        console.log(`Starting server at http://localhost:${PORT}`);
        console.log('Press Ctrl+C to stop the server\n');
    } catch (error) {
        console.error('Error finding images:', error.message);
        process.exit(1);
    }
}

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

    // API endpoint to get list of images (returns absolute paths)
    if (req.url === '/images') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(absoluteImagePaths));
        return;
    }

    // Serve individual images
    if (req.url.startsWith('/image/')) {
        const requestedPath = decodeURIComponent(req.url.substring(7));

        // Security: ensure the requested file is in our image list
        if (!absoluteImagePaths.includes(requestedPath)) {
            res.writeHead(404);
            res.end('Image not found');
            return;
        }

        const ext = path.extname(requestedPath).toLowerCase();
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        fs.readFile(requestedPath, (err, data) => {
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
