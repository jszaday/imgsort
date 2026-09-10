# Image Sorter

A fast, browser-based utility for quickly triaging images into one or more named
categories and generating a script that organizes them **without moving files
around or deleting anything**: every kept image is moved once into a single
hidden per-run store, and each category it belongs to gets a lightweight
navigational reference (a symlink, or a `.lnk` shortcut on Windows) back to it.

## Scope: single local user only

imgsort is a tool you run on your own machine against your own files. It is
**not** a service and must not be hosted for multiple users:

- The server has **no authentication** and serves files from the directory it
  is pointed at.
- It writes its own state (`.imgsort-session.json`) and the generated
  store / reference tree **into that same directory** — normally your project
  or photo folder, not a scratch dir.
- One server = one scan + one session file. Two people, or even two browser
  tabs making different decisions, will overwrite each other.

Point it at your files, sort, run (or discard) the generated script, done.

## Features

- Clean, distraction-free interface
- Put each image in one or more categories with single keystrokes
- Create new categories on the fly (`+`, or the button)
- Navigate back to change previous decisions
- Generates a POSIX `sh`, macOS `zsh`, or Windows PowerShell script to copy or
  download — the canonical single store, references not moves, nothing deleted

## Installation

```bash
npm install
```

## Usage

```
Usage: node server.js [-r|--recursive] [--out <dir>] [--follow-symlinks]
                      [--single-key-advance|--no-single-key-advance]
                      [--no-single-store-unchanged] [--keep-uncategorized]
                      [--omnibar-focus|--hotkey-focus] [--no-session]
                      [-h|--help] <directory|glob>
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
- `--keep-uncategorized` — keep `uncategorized` sticky. By **default**
  `uncategorized` is a self-emptying bucket: adding any real category to an
  image also removes `uncategorized` from that image (same shape as the
  "adding a real category removes `trash`" rule; only an exact `uncategorized`
  match is affected — nested `-r` categories like `trip/rome` are independent).
  With this flag, `uncategorized` behaves like any other label.
- `--omnibar-focus` / `--hotkey-focus` — sorter-screen focus behavior.
  **`--hotkey-focus` (default)**: the omnibar does not auto-focus, the bare
  `1`-`9` / `a`-`z` keys drive everything, and `/` jumps to the omnibar.
  `--omnibar-focus`: the omnibar holds focus and re-grabs it on every image, so
  you fuzzy-find categories by typing; `Esc` releases it so the bare keys work
  until the next image. Toggle live from the pill at the omnibar's right end.
- `--follow-symlinks` — follow symlinked files and directories while scanning.
  Default: symlinks are ignored entirely (not collected, not descended). With
  the flag, a symlinked file is interned by its `realpath` and symlink loops
  are guarded against.
- `--no-session` — disable the resumable session. By default every decision is
  autosaved to `.imgsort-session.json` in the start directory so you can quit
  and resume, undo and redo (see [Sessions](#sessions)); this turns it off.
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
CLI) — every flag listed above, with examples.

Then open your browser to: http://localhost:3000

Paths served (and referenced by the generated script) stay relative to the
directory the server was started from, so a non-cwd directory argument just
means the relative paths carry its prefix.

## Category model

Every image starts in **`uncategorized`**. Each image holds a **set** of
categories — it can live in several at once. Two categories always exist and are
keyed first:

- `1` = **uncategorized** — a **self-emptying default bucket**: adding any real
  category to an image also drops `uncategorized` from it (disable with
  `--keep-uncategorized`). Only an exact `uncategorized` match; nested `-r`
  categories are independent.
- `2` = **trash** — **exclusive**: adding `trash` clears every other category on
  that image, and adding any real category removes `trash`. A `trash` item is
  interned into the store but gets **no reference** (recoverable, never deleted).

Emptying an image's set falls back to `{uncategorized}`.

In **directory + `-r`** mode, every distinct discovered category is added after
`trash`, in first-seen order, and each image starts in its own discovered
category.

User-created categories come next, in creation order — `+` (or the
**+ New category** button) opens a small in-app popup (name, inline validation).
`⌘N` / `Ctrl+N` also works where the browser doesn't reserve it.
A newly created category is immediately applied to the current image. Discovered
categories bypass the separator rule — they legitimately contain `/`.

Category buttons are ordered **alphabetically by default** (with `uncategorized`
then `trash` pinned first); the Options menu switches this to Added (first-seen)
or Most-used. The keyboard keying follows the on-screen order: 1st–9th by digits
`1`-`9`, the 10th onward by bare letters `a`-`z`, cap **35** (9 digits + 26
letters). Each button shows its key badge, name, and a **live count** of how
many images currently carry that label (booru-style, e.g. `landscape 42`).
⌘/Ctrl + letter is reserved for actions.

## Controls

### Sorter-screen layout

The image sits at the **bottom of the app z-order** — fit to the viewport over
the receding checkerboard backdrop — and all the chrome floats over it:

- a **dock** pinned to the top edge: filename (hover for the full path), the
  `N / M` counter, the save indicator, `↶` / `↷` undo/redo, the focus-mode
  chip, the Advance pill, and a **`?`** button that opens the keyboard &
  session popup.
- a **bottom cluster**, centered and hugging the bottom edge: the omnibar on
  top, the category buttons (wrapping, centered) below it. Everything is
  translucent so the image reads through.

That's the whole sorter screen — image, dock, omnibar, buttons. Navigation is
by keyboard (Space/↓ next, ↑ previous) or by **swipe on the image** — drag or a
two-finger trackpad swipe, left → next / right → previous (works regardless of
where keyboard focus is). The chrome **hides while you drag or scroll on the
image** (a move gesture) and springs back ~0.35 s after it ends; a gesture that
starts on a button or the omnibar is a normal interaction.

### The category omnibar

Type to fuzzy-find categories (subsequence match, ranked by consecutive runs,
word-boundary starts after `/ - _` space, and earliness); `↑`/`↓` move the
highlight, `Enter` picks it, `⌘`/`Ctrl`+`1`-`9` jump to row N, `Esc` clears then
blurs. If what you typed is a valid new category name and nothing matches it
exactly, the last row is `Create "<name>"` — picking it creates the category and
applies it to the current image. Picking any row routes through the same
toggle-and-maybe-advance path as the category buttons.

As you type, the matched characters also **light up in the category buttons
themselves** — a staggered accent pop on the hit chars, non-matching buttons
dimmed (static highlight only under `prefers-reduced-motion`). Clearing the
query / blurring the box restores plain labels.

Inside the box, **double-tap `→`** skips to the next image and **double-tap
`←`** to the previous — so you can advance without leaving Search focus.

The pill at the box's right end switches **focus mode** (`⌨ Hotkeys` /
`🔍 Search`), also set at launch with `--hotkey-focus` (default) /
`--omnibar-focus`. In Hotkeys mode the bare keys drive everything and `/` jumps
to the box; in Search mode the box keeps focus and re-grabs it on every image
(so typing always filters; press `Esc` to use the bare hotkeys). The dock shows
a `⌨` / `🔍` indicator of the current mode.

### Keyboard Shortcuts

- **1-9** / **a-z** (bare): toggle that category for the current image
  (multi-select). Whether this also advances is the effective advance mode
  (below). Ignored while ⌘/Ctrl/Alt is held, or — in Search mode — while the
  omnibar holds focus.
- **/**: focus the omnibar · **Esc** in it: clear, then release focus ·
  **double-tap ← / →** in it: previous / next image
- **+** (`Shift+=`): create a new category (auto-applied to the current image).
  `⌘N` / `Ctrl+N` too, where the browser allows it
- **Space** / **Down Arrow**: next image · **Up Arrow**: previous image
- **Swipe** (drag or two-finger) on the image: left → next, right → previous
- **?** button (dock): full shortcut list + "Clear session"

### Advance mode & the Advance pill

The Advance pill in the dock shows the **effective** advance mode:

- **Auto** — a category key also advances to the next image.
- **Manual** — a category key only toggles; you advance yourself.

Unpinned, it _follows your position_: with `--single-key-advance` it's Auto at
the triage frontier and flips to Manual whenever `currentIndex` is behind the
furthest image you've reached (i.e. you went back to fix something), then
restores Auto once you catch back up. Without the flag it's always Manual.

Click the pill to cycle: follow → pin **Auto** → pin **Manual** → follow. A lock
glyph marks a pinned state; a pinned mode ignores position and the base flag.

### Mouse Controls

- **Category buttons**: toggle that category (multiple can be active; active
  ones are highlighted and show a live count)
- **+ New category**: opens the new-category popup (applied to the current image)
- **↶ / ↷** (dock): undo / redo the last decision
- **⚙** (dock): the Options menu
- **`?`** (dock): keyboard reference + Clear session

### Options menu

The **⚙** button in the dock opens a live settings panel — changes apply
immediately, there's no Apply button, and closing is just dismiss. Rows are
grouped **Sorting / Output / Appearance / Session**:

| Setting                               | What it does                                                                                                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single-key advance                    | the `--single-key-advance` base (the Advance pill still layers on top)                                                                                                      |
| Focus mode                            | Hotkeys / Omnibar — kept in sync with the omnibar pill                                                                                                                      |
| Keep `uncategorized`                  | the `--keep-uncategorized` behavior; takes effect on future toggles, a replay re-derives with the current value                                                             |
| Category button order                 | Alphabetical (default) / Added / Most used — `uncategorized`/`trash` stay first; "Most used" re-sorts only when the category list changes; the key badges follow this order |
| Intern items unchanged from discovery | `--no-single-store-unchanged` inverted (on by default)                                                                                                                      |
| Output root                           | the `--out` value (text input)                                                                                                                                              |
| Theme                                 | System / Light / Dark (manual override via `data-theme` on `:root`)                                                                                                         |
| Background grid animation             | on by default; **forced off** and the row disabled under `prefers-reduced-motion`                                                                                           |
| Autosave session                      | the `--no-session` equivalent; the row is disabled if the server itself was started with `--no-session`                                                                     |

**Persistence** — these are **global preferences** in `localStorage`
(`imgsort-prefs`), not per-session. On load, per setting: if the matching **CLI
flag was explicitly passed** the CLI value wins _and is written back_ to
`localStorage`; otherwise the stored preference is used, else the built-in
default. So a plain `node server.js …` is idempotent (your saved prefs stand),
and passing a flag updates the stored pref. `--out` follows the same rule
(explicit wins and is stored; else the last stored value; else `.`).

### In-app popups

`imgsort` never uses `window.prompt` / `window.confirm`. New-category, clear-
session confirm, the keyboard reference and the Options menu are small
focus-trapped popups (dimmed backdrop, `Esc` cancels, `Enter` confirms a
non-destructive primary, click-outside cancels), theme-tokenized for light and
dark.

## Sessions

Your sort is a transaction log — one entry per decision (toggle a category, set,
or create-and-apply). `folders` and `assignments` are always _derived_ by
replaying that log onto the run's base (reserved + discovered categories). This
powers both undo/redo and resume.

- **Undo / redo** — `⌘Z` / `Ctrl+Z` and `⌘⇧Z` / `Ctrl+Y` (also from inside the
  omnibar), or the `↶` / `↷` buttons in the dock. Undo jumps you back to the
  image it changed.
- **Autosave** — unless started with `--no-session`, every decision and
  navigation is debounced-saved (~0.5s) to `.imgsort-session.json` in the start
  directory (a hidden dotfile; also flagged hidden on Windows). A small
  `saving… / saved ✓` indicator sits in the dock.
- **Resume** — on the next launch the saved log is **rolled forward onto the
  current scan's base**: saved decisions win, and any decision whose image is no
  longer present is dropped. A banner reports `Resumed N saved decisions`
  (`… from a different image set` when the image set changed; `(M skipped: …)`
  when some were dropped) with a `Discard & start fresh` action. The pruned log
  is re-saved immediately. The `currentIndex` / frontier / advance-pin restore
  is best-effort.
- **Clear session** — from the dock `?` popup; deletes the file (and any
  browser copy) and resets to the base sort after an in-app confirm.
- **Browser fallback** — if the server can't write the file (read-only dir,
  etc.) imgsort falls back to `localStorage` and shows a dismissible
  `Session saved in this browser only.` strip. That copy is also read on load if
  no server-side file exists.

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
  yet special-case or ignore `.imgsort-store-*` directories — or a stale
  `.imgsort-session.json` — on a rescan; a session is only cleaned via the
  Discard / Clear actions.
- **Many stores**: each run creates its own store; there's no consolidation of
  multiple stores into one yet.
- **Session `meta` resume** (`currentIndex` / frontier / advance-pin) is
  best-effort — the transaction log itself always replays faithfully.

## Notes

- The sort lives in a transaction log, autosaved to `.imgsort-session.json`
  unless `--no-session` (see [Sessions](#sessions))
- Nothing is moved or deleted until you run the generated script yourself
- Press Ctrl+C in the terminal to stop the server

## Development

```bash
npm run lint        # eslint (**/*.js)
npm run typecheck   # tsc --noEmit, checkJS (*.js, lib/, test/)
npm run format      # prettier --write .  (the only automated check for index.html's inline JS/CSS)
npm test            # vitest (test/**/*.test.js)
```

All four should pass before committing.

The pure, DOM-free logic lives in `lib/*.js` ES modules — `hash.js` (FNV-1a),
`fuzzy.js` (omnibar ranking), `categories.js` (category-set rules incl.
`applyToggle`, key badges, and `countLabels` / `applyCountDelta` for the live
per-label counts), `txns.js` (`replay()` folds the transaction log onto the
discovered base),
`script.js` (`buildOps` + the POSIX / Windows lowerers), `scan.js` (`parseArgs`,
`isImageFile`, `collectFromDir`). `server.js` imports them directly; the browser
loads them from the `/lib/<name>.js` route, and `index.html`'s inline
`<script type="module">` keeps only the DOM wiring. `index.html` stays a single
self-contained file (inline CSS + that one script) — no bundler, no new runtime
deps. See `CLAUDE.md` for repo conventions.
