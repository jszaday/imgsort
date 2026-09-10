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

```
Usage: node server.js [-r|--recursive] [-h|--help] <directory|glob>
```

The positional argument is either an existing **directory** or a **glob**
pattern. Options are order-independent.

- `-r`, `--recursive` — when the argument is a directory, walk it recursively.
  Ignored for glob arguments.
- `-h`, `--help` — print help and exit.

Image match is by file extension, **case-insensitive** (`.JPG`, `.Png`, … all
match).

### Directory

```bash
node server.js ./photos        # image files in ./photos top level only
node server.js -r ./photos     # ./photos and every subdirectory
```

With `-r`, each image's **category** is seeded from its parent directory
relative to the given root (POSIX slashes): `photos/trip/rome/x.jpg` →
category `trip/rome`; a file directly in `photos/` → `uncategorized`. Those
categories become pre-seeded folders (see below). Without `-r` (or with a
glob) every image starts `uncategorized`.

### Glob

```bash
node server.js "**/*.{jpg,jpeg,png,gif}"
node server.js "./photos/**/*.jpg"
```

Quote the glob so the shell doesn't expand it.

### `-h` output

```
imgsort — local browser-based image-triage tool

Usage: node server.js [-r|--recursive] [-h|--help] <directory|glob>

Arguments:
  <directory|glob>   An existing directory to scan for images, or a glob
                     pattern (quoted). Image match is by extension,
                     case-insensitive: jpg,jpeg,png,gif,bmp,webp,svg

Options:
  -r, --recursive    When the argument is a directory, walk it recursively.
                     With -r, each image's category is seeded from its
                     parent directory relative to the given root.
                     Ignored for glob arguments.
  -h, --help         Show this help and exit.

Examples:
  node server.js ./photos                 # top level of ./photos
  node server.js -r ./photos             # ./photos and all subdirectories
  node server.js "**/*.{jpg,jpeg,png}"  # glob (quote to protect from the shell)

Then open http://localhost:3000
```

Then open your browser to: http://localhost:3000

Paths served (and referenced by the generated script) stay relative to the
directory the server was started from, so a non-cwd directory argument just
means the relative paths carry its prefix.

## Folder model

Every image starts in the default **`uncategorized`** folder. Two folders always
exist and are numbered first:

- `1` = **uncategorized** — a real destination folder like any other; checked
  items are moved into `./uncategorized/`
- `2` = **trash** — files are deleted (`rm -i`)

In **directory + `-r`** mode, every distinct discovered category (see Usage) is
added as a folder after `trash`, in first-seen order, and each image starts
assigned to its own discovered category.

User-created folders come next, in creation order. Click **+ New folder** and
enter a name (non-empty, no `/` or `\`, not a duplicate, and not the reserved
names `trash` / `uncategorized`). Discovered categories bypass the separator
rule — they legitimately contain `/`.

Folders are keyed for the keyboard: the 1st–9th by digits `1`-`9`, the 10th
onward by letters `a`, `b`, `c`, … pressed **with a modifier** (⌘ on macOS,
Ctrl elsewhere). Cap is **35** folders (9 digits + 26 letters). Each folder
button's badge shows its key (`⌘A` / `^A` for letter keys).

## Controls

### Keyboard Shortcuts

- **1-9**: Assign the current image to that folder and move to the next image
- **⌘/Ctrl + letter**: Assign to the 10th+ folder (⌘ on macOS, Ctrl elsewhere)
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
4. After the last image, the end screen is an interactive **checklist**: one
   collapsible group per non-empty folder, every item checked by default. Each
   group has a master checkbox (checked / unchecked / indeterminate) and a
   collapse toggle on its header. Checking or unchecking items controls exactly
   what goes into the generated script, which re-renders live.

### Generated script

Below the checklist is the generated script in a two-tab view with **Copy** and
**Download** buttons per tab. It updates live as you check and uncheck items:

- **POSIX sh** — `#!/bin/sh`, uses `rm -i` for the `trash` folder, downloads as
  `imgsort.sh`
- **macOS** — `#!/bin/zsh`, uses the `trash` CLI (`brew install trash`) for the
  `trash` folder, downloads as `imgsort.command`

The macOS tab is auto-selected on macOS browsers; you can switch manually. In both
variants the script:

- starts with a shebang (`#!/bin/sh` or `#!/bin/zsh`) and `set -e`; it has no `cd`
  line and is meant to be run from the directory the images are relative to (the
  directory the server was started from)
- runs `mkdir -p <folder>` once per folder that has checked items (including
  `uncategorized`), then `mv -i ./<file> <folder>/` for each checked file
- deletes the `trash` folder's checked files (`rm -i ./<file>` on POSIX,
  `trash ./<file>` via the `trash` CLI on macOS), preceded by a
  `# review carefully` comment
- skips any folder with no checked items entirely
- **skips an item whose current assignment equals its originally-discovered
  category** — it is already in the right place, so no `mv` is emitted for it
  (and its destination gets no `mkdir -p` unless another item moves there).
  Reassigned items, including back to `trash` or `uncategorized`, emit normally
- path separators in all script output are always POSIX `/` regardless of the
  viewer's OS; the UI shows `\` on Windows for readability only
- appends `# <n> item(s) left unchecked and untouched` when some items are
  unchecked; if nothing is checked at all the body is just the shebang, `set -e`,
  and a `# nothing selected` comment

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
