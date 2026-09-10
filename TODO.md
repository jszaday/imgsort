# TODO

Backlog, roughly in priority order. Move items to a commit / PR as they land.

## Now / in progress

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
- Category buttons sort by `sortFolders(folders, {by, counts})` (`lib/`) —
  alpha default, or added / count. Notes: `'count'` order is **stable until the
  button set changes** (a rebuild on add/remove or menu change), deliberately
  not reshuffling on every toggle. Key badges (1-9 / a-z) now shift with the
  sort order and with additions — acceptable; the omnibar is the stable
  name-based path, and `pressCategoryByIndex` / the omnibar badge both route
  through the sorted `displayFolders()` view so keys match what's on screen.

## Next

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
