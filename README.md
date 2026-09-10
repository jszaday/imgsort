# Image Sorter

A fast, browser-based utility for quickly triaging images into named folders and
generating a shell script that moves (or deletes) them.

## Features

- Clean, distraction-free interface
- Assign each image to a named folder with a single digit key
- Create new folders on the fly
- Navigate back to change previous decisions
- Generates a shell script (POSIX `sh` or macOS `zsh`) you can copy or download

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

## Folder model

Every image starts in the default **`uncategorized`** folder. Two folders always
exist and are numbered first:

- `1` = **uncategorized** — files stay where they are
- `2` = **trash** — files are deleted (`rm -i`)

User-created folders are numbered `3`-`9` in the order they were created. Click
**+ New folder** and enter a name (non-empty, no `/`, not a duplicate, and not the
reserved names `trash` / `uncategorized`).

## Controls

### Keyboard Shortcuts

- **1-9**: Assign the current image to that numbered folder and move to the next image
- **Up Arrow**: Go to previous image
- **Down Arrow**: Go to next image

### Mouse Controls

- **Folder buttons**: Assign the current image to that folder and move forward
- **+ New folder**: Create a new numbered folder
- **Previous/Next Buttons**: Navigate between images

## How It Works

1. Start the server with a glob pattern matching your images
2. Create the folders you need, then page through the images assigning each one
3. Go back anytime to change a previous assignment
4. After the last image, the results screen shows one section per non-empty folder
   (`uncategorized` is shown but labeled as staying put)

### Generated script

The results screen shows the generated script in a two-tab view with **Copy** and
**Download** buttons per tab:

- **POSIX sh** — `#!/bin/sh`, uses `rm -i` for the `trash` folder, downloads as
  `imgsort.sh`
- **macOS** — `#!/bin/zsh`, uses the `trash` CLI (`brew install trash`) for the
  `trash` folder, downloads as `imgsort.command`

The macOS tab is auto-selected on macOS browsers; you can switch manually. In both
variants the script:

- starts with a shebang (`#!/bin/sh` or `#!/bin/zsh`), `set -e`, and `cd` into the
  directory the server was started from (`process.cwd()`, exposed via the
  `/config` endpoint)
- runs `mkdir -p <folder>` once per user folder, then `mv -i <file> <folder>/` for
  each file
- deletes the `trash` folder's files (`rm -i` on POSIX, the `trash` CLI on macOS),
  preceded by a `# review carefully` comment
- leaves `uncategorized` files untouched, emitting a comment with the count

Every path is single-quote shell-escaped. The script is also printed to the
browser console.

## Notes

- All assignments are stored in memory (not saved to disk)
- Nothing is moved or deleted until you run the generated script yourself
- Press Ctrl+C in the terminal to stop the server

## Development

```bash
npm run lint        # eslint (**/*.js)
npm run typecheck   # tsc --noEmit, checkJS (*.js)
npm run format      # prettier --write .  (the only automated check for index.html)
```

All three should pass before committing. `index.html` is a single self-contained
file with inline CSS/JS — keep it that way; no build step, no new dependencies
without discussion. See `CLAUDE.md` for repo conventions.
