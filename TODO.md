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

## Next

- Consolidate multiple `.imgsort-store-*` dirs from repeated runs into one store
  (dedupe by content / path), instead of a fresh store per run.
- On rescan, the app does **not** currently ignore `.imgsort-store-*` dirs or
  recognize existing reference symlinks/`.lnk`s as already-sorted — it'll re-add
  store copies as fresh images (and, without `--follow-symlinks`, silently skip
  the references). Decide on skip rules / a resume mode.
- Discovered categories bypass `hash8` collision naming only at intern time;
  two same-basename items in the same category still collide on the reference
  name. Currently the reference reuses the (already-deduped) store name, so
  this is fine — revisit if store naming changes.
- Discovered categories (`-r`) aren't bounded by `MAX_FOLDERS` (35), so a deep
  tree can seed folders past the digit+letter keyspace — those get unusable
  badges (past `Z`) and no working shortcut. Decide: cap + spill to a picker, or
  wait for the accented-key tier below.
- `--single-key-advance` now shadows `⌘/Ctrl+letter`, which is reserved for
  actions (only `⌘N` used so far). Room for more action chords.

## Later

- In-app day/night toggle in the dock. The palette is already all CSS custom
  properties (dark base + `prefers-color-scheme: light` override); this would
  add a manual switch (button in the dock) that stamps `data-theme` on `:root`
  and persists the choice, overriding the media query.

### Accented / Option-key shortcut tier (macOS)

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
