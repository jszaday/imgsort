# TODO

Backlog, roughly in priority order. Move items to a commit / PR as they land.

## Now / in progress

- CLI: `-h`/`--help`, directory input, `-r` recursive, subdir-seeded categories,
  letter keys for folders past 9. _(in progress)_

## Next

- Discovered categories (`-r`) aren't bounded by `MAX_FOLDERS` (35), so a deep
  tree can seed folders past the digit+letter keyspace — those get unusable
  badges (`⌘{` …) and no working shortcut. Decide: cap + spill to a picker, or
  wait for the accented-key tier below.

## Later

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
