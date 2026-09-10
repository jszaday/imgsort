# TODO

Backlog, roughly in priority order. Move items to a commit / PR as they land.

## Now / in progress

- Results-as-popup rework: the end-of-run screen is now an in-app modal
  (`openResults`, `.results-modal` — scrim / Esc / focus-trap like `openPopup`,
  no more `#sorter`/`#results` display swap) openable any time via the **☑**
  dock button, **Enter** (outside the omnibar), or advancing past the last
  image. Tabs: **Script** (default) + one per non-empty category + **Actions**.
  _(landed)_
    - The Script tab _is_ the checklist rendered as a script: `lowerPosix` /
      `lowerWindows` now return `{ text, lines }`; a `Line.ref` (`{category,path}`)
      on the `ln -nfs` / `.lnk` lines drives a gutter checkbox bound to the same
      `checkedRefs` key as the group-tab rows. Unchecked → dim + `# `-commented
      display row; Copy / Download rebuild a clean script from the ticked lines
      only (`buildOps` gained `state.keepUncheckedRefs` for the display lowering
      and a `path` on each `reference` op). `buildOps` 3 call sites → one `lower()`
      helper; all `lib` script tests updated + `ref`/reconstruct tests added.
    - Actions tab: `txns[]` viewer with Disable (sets `tx.disabled`, round-trips
      in the session file, `replay()` skips it — test added) / Delete (splice).
    - `storeName` regenerated once per popup open.
    - Autosave no longer fires on plain navigation (`showImage` lost its
      `scheduleSave()`); cursor position rides the next real mutation, plus an
      immediate `flushSessionNow()` on `visibilitychange`/`pagehide` via
      `navigator.sendBeacon('/session')` (no new browser-storage path).

- Single-store + navigational-reference model: multi-category assignment
  (`assignments[i]` is a Set), `--out`, `--no-single-store-unchanged`,
  `--follow-symlinks`, `--single-key-advance`, and the third (Windows /
  PowerShell `.lnk`) script tab. _(landed)_
- Creating a category auto-applies it to the current image. _(landed)_ Could
  become a toggle (flag or dock control) if "create without applying" turns
  out to be a real need.
- Extract pure logic to `lib/*.js` ESM + a vitest suite (`test/`, 67 tests).
  _(landed)_ `server.js` and `index.html` re-import; the browser gets the
  modules via a `/lib/<name>.js` route; `server.js` bootstrap is guarded so
  importing it doesn't start the server. Notes: `replay()` now skips a `create`
  txn whose image is absent _whole_ (original re-added the folder anyway) — a
  case the resume-time prune already removed, so no behavioral change through
  the app. `showResults`/`renderChecklist` and the rest of the DOM code stayed
  inline; only the pure cores moved.
- Resumable sessions: per-decision transaction log (`txns[]` is the source of
  truth, `folders`/`assignments` derived via `replayTxns`), autosave to
  `.imgsort-session.json` with `--no-session` to disable, roll-forward resume,
  undo/redo (`⌘Z`/`⌘⇧Z` + dock buttons), localStorage fallback. _(landed)_
- Category omnibar with fuzzy find + `--omnibar-focus` / `--hotkey-focus`.
  _(landed)_ Known gap: in Search-focus mode, bare digit keys are query text,
  so you can't fuzzy-match a category whose name starts with a digit by typing
  the digit first (minor — arrows/click still reach it; hotkey-focus mode is
  unaffected).
- Sorter-screen overlay rework: image at the bottom of the app z-order, all
  chrome floats over it (dock + bottom cluster), chrome hides during a
  drag/scroll gesture on the image, live booru-style per-label counts
  (`countLabels`/`applyCountDelta` in `lib/categories.js`, incremental on the
  normal path), in-app popups replacing `window.prompt`/`window.confirm`,
  default focus mode flipped to `hotkeys`, `uncategorized` is now a
  self-emptying bucket (`--keep-uncategorized` to opt out). _(landed)_
  Prev/Next are back as ‹ › arrows flanking the omnibar; ←/↑ = previous,
  →/↓/Space = next. No real zoom/pan — the gesture listeners only detect
  "gesture in progress" and nudge the image a few px for feedback.
  Fixed: a global `[hidden] { display: none !important }` — component
  `display` rules were beating the UA rule and showing hidden banners empty.
- In-app **Options menu** (⚙ in the dock) exposing the runtime-adjustable
  settings — single-key-advance, focus mode, category button order,
  keep-uncategorized, intern-unchanged, output root, theme (System/Light/Dark
  via `data-theme`), grid animation, autosave. _(landed)_ Persistence: global
  prefs in `localStorage['imgsort-prefs']` (not per-session); on load an
  explicit CLI flag wins and is written back, else the stored value, else the
  default. `parseArgs` now reports `explicit[]`; `/images` options carries it.
  `--out` is stored as the raw relative string (the script has no `cd`).
- Omnibar polish: (a) typing echoes the fuzzy match **on the category buttons**
  — hit chars wrapped in `<span class="fz">` with a staggered pop, non-matching
  buttons dimmed; `lib/fuzzy.js` `fuzzyMatchIndices()`; off the hot path via
  `applyOmniHighlight()`, re-applied on rebuild, cleared on blur / Esc / pick /
  empty. (b) double-tap `←` / `→` in the omnibar navigates (350 ms window).
  (c) **swipe navigation** on `#imageLayer` — a pointer swipe (dx over 60px and
  predominantly horizontal, or a fast flick) and a two-finger wheel (accumulate
  deltaX, fire once past 80, lock until the 180 ms re-arm timer settles so
  momentum doesn't repeat). Works regardless of keyboard focus. _(landed)_
  Wheel-swipe direction (`deltaX` sign → next/prev) is a guess and
  OS-natural-scroll-dependent; may want a flip or an Options toggle. The
  horizontal `wheel` listener is `passive:false` + `preventDefault` so it
  doesn't also trigger the browser's back/forward history swipe.
- Category buttons sort by `sortFolders(folders, {by, counts})` (`lib/`) —
  alpha default, or added / count. Notes: `'count'` order is **stable until the
  button set changes** (a rebuild on add/remove or menu change), deliberately
  not reshuffling on every toggle. Key badges (1-9 / a-z) now shift with the
  sort order and with additions — acceptable; the omnibar is the stable
  name-based path, and `pressCategoryByIndex` / the omnibar badge both route
  through the sorted `displayFolders()` view so keys match what's on screen.

## Next

- **Apply button in the results popup** — a server endpoint that executes the
  generated ops (intern + reference) directly instead of handing the user a
  script to run; needs a dry-run/confirm and to reconcile with the
  not-yet-built rescan + project-keyed store. Deliberately deferred — the popup
  stays Copy / Download for now.
- **Content-addressed single store (sha256)** — the store's identity should
  ultimately be `sha256(file bytes)`, not basename+`hash8(path)`: identical
  content dedupes to one store entry with N references regardless of
  name/origin. The **server** computes the digest (lazily / streamed — hashing
  a large scan up front is slow); store filename becomes `<sha256>` (or
  `<sha256[:16]>-<basename>` for browsability) with the real extension. Pairs
  with the project-keyed-store and store-consolidation items. Confirmed
  direction.
- **Live rescan** — the disk scan only runs at server startup. Add a `/rescan`
  endpoint that re-runs the scan (updating `imageFiles` / `imageCategories` /
  `imageSetHash`) and, client-side, an Options-menu **Rescan now** button plus
  an **auto-refresh** toggle (poll on an interval). New files appear as unsorted
  images in their discovered category; removed files get pruned from the txn log
  the same roll-forward way `resumeSession` does. **Prerequisite**: the rescan
  must skip imgsort's own output — `.imgsort-store-*` dirs,
  `.imgsort-session.json`, and (without `--follow-symlinks`) the generated
  reference tree. This folds in the old "rescan doesn't ignore
  `.imgsort-store-*` / existing reference symlinks / a stale
  `.imgsort-session.json`" blind spot — `isImageFile` already excludes `.json`
  so the session file isn't re-scanned, but the store dirs and reference links
  are not yet filtered.
- Consolidate multiple `.imgsort-store-*` dirs from repeated runs into one store
  (dedupe by content / path), instead of a fresh store per run.
- Session `meta` resume (currentIndex / frontier / pinnedMode) is best-effort —
  clamped to the current image set, silently defaulted when missing. The txn
  log replays faithfully; only the cursor position is fuzzy.
- Discovered categories bypass `hash8` collision naming only at intern time;
  two same-basename items in the same category still collide on the reference
  name. Currently the reference reuses the (already-deduped) store name, so
  this is fine — revisit if store naming changes.
- Discovered categories (`-r`) aren't bounded by `MAX_FOLDERS` (35), so a deep
  tree can seed folders past the digit+letter keyspace — those get unusable
  badges (past `Z`) and no working shortcut. The **omnibar is now the scaling
  answer** for >35 categories (fuzzy-find works regardless of keyspace); this
  item shrinks to "make categories past 35 usable" (no badge, reachable only
  via the omnibar / buttons) rather than needing a new key tier. May make the
  accented-key tier below unnecessary — keep it noted, don't build it yet.
- `--single-key-advance` now shadows `⌘/Ctrl+letter`, which is reserved for
  actions (only `⌘N` used so far). Room for more action chords.

## Later

- **Package as a desktop app (Tauri, or Electron).** This is effectively a
  proto-Tauri app already — a webview frontend over a local Node backend, with
  file-local state, no auth, gesture nav, and in-app popups instead of browser
  dialogs. Natural endpoint: `index.html` stays the frontend, `server.js`'s
  logic becomes the backend command layer, state moves to a real app-data dir,
  and the single-local-user / multi-hosting caveat disappears. `lib/*.js` is
  already the portable, dependency-free core.
- Retire the `localStorage` session fallback — the decision log must stay
  file-local. On a `POST /session` failure, surface it and offer a file path /
  download rather than silently stashing in the browser. Also `Cache-Control:
no-store` on `/image/` so photo bytes don't linger in the browser cache.
  (Privacy: only benign UI prefs belong in `localStorage`.)
- **Diagnostics / Inspector tab** in the results popup — per image: discovered
  category + origin realpath, the computed store path (once sha256 lands), and
  label-count cache state. "As necessary" — a debugging aid, not core.
- Is the cursor (`currentIndex` / `frontier`) part of the action stack or just
  view state? Currently `meta`, not `txns` — leaning keep it that way
  (navigation isn't a decision; putting it in `txns` would make undo/redo step
  through cursor moves). Open.
- Session file location — writing `.imgsort-session.json` into the working /
  photo dir is a smell; `TMPDIR` is too fragile. Leading candidate: an OS state
  dir keyed by project identity (`~/Library/Application Support/imgsort/` on
  macOS, `$XDG_STATE_HOME` / `~/.local/state/imgsort/` on Linux), `<projkey>` =
  hash of realpath(input) + realpath(`--out`) — same key as the project-keyed
  store. Working-dir file stays as fallback / `--session-file <path>` override.
  Ultimately a real embedded store (SQLite) more than loose JSON. Open.
- Open question — should nested categories sharing a path prefix be mutually
  exclusive within that subtree (e.g. picking `uncategorized/foo` clears sibling
  `uncategorized/*`)? Currently they're independent; the reserved bare
  `uncategorized` is the only path-namespace special case, and a discovered dir
  literally named `uncategorized` already shadows it.
- Store dir name **keyed by project** instead of per-run timestamp+uuid: hash
  the `fs.realpathSync` of `--out` + the `fs.realpathSync` of the input dir (not
  the raw argv strings), so re-running the same project reuses / appends to one
  `.imgsort-store-<projkey>` rather than scattering `.imgsort-store-*`. Pairs
  with the store-consolidation item above; **open — needs the rescan / ignore
  story (Live rescan, above) sorted first.**

### Accented / Option-key shortcut tier (macOS)

_Possibly obsoleted by the omnibar — see the keyspace item under Next. Kept for
reference; only build if a keyboard-only tier past 35 is still wanted._

When folder count exceeds digits (`1`-`9`) + letters (`a`-`z` with ⌘/Ctrl),
allocate from a curated pool of comfortable Option-key characters.

- Match on the final composed `e.key` (e.g. `e.key === 'ü'`) — the browser
  already composes ⌥U,U / press-and-hold into one `keydown`. No sequence state
  machine.
- Encode each shortcut as `{ char, badge, hint }` where `hint` is display-only
  teaching text (`'⌥U, then U'`), never parsed.
- Curated table of ~20 entries: é ⌥E·E, ü ⌥U·U, ñ ⌥N·N, ç ⌥C, ø ⌥O, å ⌥A, …
- Badge shows the char; dim `hint` next to the folder button.
- Guard: enable this tier only on macOS (⌥ produces these reliably); elsewhere
  fall back to click-only rather than show an unusable hint.
- Slots into the same key-allocation function as digits/letters.
