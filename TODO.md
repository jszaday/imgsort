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

## Next

- Consolidate multiple `.imgsort-store-*` dirs from repeated runs into one store
  (dedupe by content / path), instead of a fresh store per run.
- On rescan, the app does **not** currently ignore `.imgsort-store-*` dirs or
  recognize existing reference symlinks/`.lnk`s as already-sorted — it'll re-add
  store copies as fresh images (and, without `--follow-symlinks`, silently skip
  the references). Decide on skip rules / a resume mode. Same blind spot for a
  stale `.imgsort-session.json`: it's only cleaned via the in-app Discard /
  Clear actions, never automatically (the roll-forward resume just prunes txns
  for images that vanished). `isImageFile` already excludes `.json`, so the
  session file itself is never re-scanned.
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

- In-app day/night toggle in the dock. The palette is already all CSS custom
  properties (dark base + `prefers-color-scheme: light` override); this would
  add a manual switch (button in the dock) that stamps `data-theme` on `:root`
  and persists the choice, overriding the media query.

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
