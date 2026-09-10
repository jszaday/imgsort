# Image Sorter

A fast, browser-based utility for quickly triaging images into one or more named
categories and generating a script that organizes them **without moving files
around or deleting anything**: every kept image is moved once into a single
hidden per-run store, and each category it belongs to gets a lightweight
navigational reference (a symlink, or a `.lnk` shortcut on Windows) back to it.

## Features

- Clean, distraction-free interface
- Put each image in one or more categories with single keystrokes
- Create new categories on the fly (`⌘N` / `Ctrl+N`, or the button)
- Navigate back to change previous decisions
- Generates a POSIX `sh`, macOS `zsh`, or Windows PowerShell script to copy or
  download — the canonical single store, references not moves, nothing deleted

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
- `--out <dir>` — output root for the generated tree (the single store plus the
  per-category reference directories). Default `.`.
- `--single-key-advance` / `--no-single-key-advance` — **base** advance mode. A
  category key (`1`-`9` / `a`-`z`) always _toggles_ that category on the current
  image; this flag decides whether it then advances. `--no-single-key-advance`
  (default) = Manual (you advance with Space / Down). `--single-key-advance` =
  Auto while you're at the triage frontier, automatically flipping to Manual
  when you navigate back to edit an earlier image. See the Advance pill below.
- `--no-single-store-unchanged` — leave an item in place (no intern, no
  reference) when its category set is unchanged from `-r` discovery. Default:
  every kept item is interned and referenced.
- `--follow-symlinks` — follow symlinked files and directories while scanning.
  Default: symlinks are ignored entirely (not collected, not descended). With
  the flag, a symlinked file is interned by its `realpath` and symlink loops
  are guarded against.
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

Run `node server.js --help` for the full option reference (kept in sync with the
CLI). It documents `-r`, `--out`, `--single-key-advance` /
`--no-single-key-advance`, `--no-single-store-unchanged`, and
`--follow-symlinks`.

Then open your browser to: http://localhost:3000

Paths served (and referenced by the generated script) stay relative to the
directory the server was started from, so a non-cwd directory argument just
means the relative paths carry its prefix.

## Category model

Every image starts in **`uncategorized`**. Each image now holds a **set** of
categories, not a single one — an image can live in several at once. Two
categories always exist and are keyed first:

- `1` = **uncategorized** — an ordinary category
- `2` = **trash** — **exclusive**: adding `trash` clears every other category on
  that image, and adding any real category removes `trash`. A `trash` item is
  interned into the store but gets **no reference** (recoverable, never deleted).

Emptying an image's set falls back to `{uncategorized}`.

In **directory + `-r`** mode, every distinct discovered category is added after
`trash`, in first-seen order, and each image starts in its own discovered
category.

User-created categories come next, in creation order — `⌘N` / `Ctrl+N` or the
**+ New folder** button (non-empty, no `/` or `\`, not a duplicate, not
reserved). A newly created category is immediately applied to the current
image. Discovered categories bypass the separator rule — they legitimately
contain `/`.

Categories are keyed: the 1st–9th by digits `1`-`9`, the 10th onward by bare
letters `a`-`z`. Cap is **35** (9 digits + 26 letters). Each button's badge
shows its key (digits, or an uppercase letter — no modifier glyph). ⌘/Ctrl +
letter is reserved for actions (`⌘N` / `Ctrl+N` = new category).

## Controls

### Keyboard Shortcuts

- **1-9** / **a-z** (bare): toggle that category for the current image
  (multi-select). Whether this also advances is the effective advance mode
  (below). Ignored while ⌘/Ctrl/Alt is held.
- **⌘N** / **Ctrl+N**: create a new category (auto-applied to the current image)
- **Space** / **Down Arrow**: next image · **Up Arrow**: previous image

### Advance mode & the Advance pill

The sorter screen is two rounded tiles — the image fills the top one, the
controls sit below — over a receding checkerboard backdrop. A floating **dock
bar** clings to the top edge of the image tile with the current filename
(hover for the full path), the `N / M` progress counter, and the Advance pill.

The pill shows the **effective** advance mode:

- **Auto** — a category key also advances to the next image.
- **Manual** — a category key only toggles; you advance yourself.

Unpinned, it _follows your position_: with `--single-key-advance` it's Auto at
the triage frontier and flips to Manual whenever `currentIndex` is behind the
furthest image you've reached (i.e. you went back to fix something), then
restores Auto once you catch back up. Without the flag it's always Manual.

Click the pill to cycle: follow → pin **Auto** → pin **Manual** → follow. A lock
glyph marks a pinned state; a pinned mode ignores position and the base flag.

### Mouse Controls

- **Category buttons**: toggle that category (multiple can be active); the
  selected ones are highlighted
- **+ New folder**: create a new category (auto-applied to the current image)
- **Previous/Next Buttons**: navigate between images

## How It Works

1. Start the server against your images
2. Page through them, toggling each image into one or more categories
3. Go back anytime to change a decision
4. After the last image, the end screen is an interactive **checklist**: one
   collapsible group per non-empty category. An image appears under **every**
   category it's in; each checkbox toggles **that one reference**. The canonical
   move-into-the-store happens once as long as the image is checked in at least
   one group. Groups have a master checkbox and a collapse toggle. The script
   re-renders live.

### The single store + references model

Nothing is moved into category folders and **nothing is deleted**. Instead:

- **Single store** — one hidden per-run directory at the output root
  (`--out`, default `.`), named
  `.imgsort-store-<YYYYMMDD-HHMMSS>-<uuid>` (generated in the browser when you
  reach the results screen; both script tabs bake in the same name).
- **Intern** — each item checked in ≥1 group (including `trash`) is `mv`'d
  **once**, flat, into the store. Its store name is its basename; on a collision
  with another interned item it becomes `<hash8>-<basename>` (`hash8` = FNV-1a
  of the item's original relative path). Each intern is loudly echoed.
- **Reference** — for every `(item, category)` still checked where
  `category != trash`, a navigational reference is created at
  `<out>/<category>/<store-name>` pointing at the store item. `trash` selections
  produce no reference.
- **`--no-single-store-unchanged`** — an item whose category set still equals
  its `-r`-discovered category is left in place (no intern, no reference).
- If nothing qualifies, the script body is just the header and a
  `# nothing to do` comment.

### Script tabs

Below the checklist, the generated script has three tabs, each with **Copy** and
**Download**. It has no `cd` and runs from the directory the images are relative
to (where the server started). All POSIX/macOS paths stay forward-slash; the
Windows tab uses backslashes.

| Tab          | File              | Lowering                                                                                                                                                                                                      |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POSIX sh** | `imgsort.sh`      | `#!/bin/sh`, `set -e`; `mkdir -p`; intern = `echo …; mv -i`; reference = `ln -nfs <relative target> <link>` (idempotent replace)                                                                              |
| **macOS**    | `imgsort.command` | identical to POSIX but `#!/bin/zsh`                                                                                                                                                                           |
| **Windows**  | `imgsort.ps1`     | `$ErrorActionPreference='Stop'`; `New-Item -Force`; store marked Hidden; intern = `Write-Host …; Move-Item -LiteralPath`; reference = a `.lnk` shortcut via `WScript.Shell` with an **absolute** `TargetPath` |

The Windows tab auto-selects on Windows browsers, macOS on Macs, else POSIX; you
can switch manually. The active script is also printed to the browser console.
POSIX/macOS paths are single-quote shell-escaped; the Windows tab uses
PowerShell single-quoted literals (`''` escapes a quote).

**`.lnk` caveat** — a Windows `.lnk` is a shortcut for human navigation in
Explorer only, not transparent filesystem indirection: programs that open
`<out>/<category>/<name>.lnk` as a path see the shortcut file, not the target.
Use the store copy for real work.

## Known limitations

- **Re-running imgsort on an already-built output tree**: the reference symlinks
  pointing at a prior store are only followed and re-processed with
  `--follow-symlinks`; by default they're skipped entirely. imgsort does **not**
  yet special-case or ignore `.imgsort-store-*` directories on a rescan.
- **Many stores**: each run creates its own store; there's no consolidation of
  multiple stores into one yet.

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
