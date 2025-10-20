# Image Sorter

A fast, browser-based utility for quickly sorting through images to decide which ones to keep or discard.

## Features

- Clean, distraction-free interface
- Keyboard shortcuts for quick sorting
- Navigate back to change previous decisions
- Tracks keep/discard/undecided status
- Shows final summary with all categorized files

## Installation

```bash
npm install
```

## Usage

Run the server with a glob pattern to match your images:

```bash
node server.js "**/*.{jpg,jpeg,png,gif}"
```

Or with a specific path:

```bash
node server.js "./photos/**/*.jpg"
node server.js "~/Pictures/**/*.png"
```

Then open your browser to: http://localhost:3000

## Controls

### Keyboard Shortcuts

- **Left Arrow**: Mark as discard and move to next image
- **Right Arrow**: Mark as keep and move to next image
- **Up Arrow**: Go to previous image
- **Down Arrow**: Go to next image

### Mouse Controls

- **Keep Button**: Mark current image as keep and move forward
- **Discard Button**: Mark current image as discard and move forward
- **Previous/Next Buttons**: Navigate between images

## How It Works

1. Start the server with a glob pattern matching your images
2. Navigate through images one at a time
3. Use arrow keys or buttons to categorize each image
4. Go back anytime to change previous decisions
5. After viewing all images, see the final summary with:
    - Keep list
    - Discard list
    - Undecided list (images you skipped)

The results are displayed on screen and also printed to the browser console for easy copying.

## Notes

- All decisions are stored in memory (not saved to disk)
- Going back updates your previous selection
- Images default to "undecided" if you don't make a choice
- Press Ctrl+C in the terminal to stop the server
