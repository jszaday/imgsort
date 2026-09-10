# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Project

`imgsort` is a local, browser-based image-triage tool. A Node http server
(`server.js`, ESM, no framework) serves `index.html` (inline CSS + a DOM-wiring
script) plus the matched image files. Run it with a directory or glob:
`node server.js -r ./photos`, then open `http://localhost:3000`.

- **Category model**: each image holds a _set_ of categories. `uncategorized`
  (default) and `trash` always exist and are reserved; `trash` is exclusive.
  Categories are keyed `1`-`9` then `a`-`z` (cap 35); a fuzzy-find **omnibar**
  is the scaling path beyond that. `-r` seeds a category per subdirectory.
- **Nothing touches the filesystem directly.** The results screen is a checklist
  that drives a generated script (POSIX `sh` / macOS `zsh` / Windows PowerShell
  tabs) the user runs themselves: every kept image is `mv`'d once into a hidden
  per-run **single store**, and each category gets a **navigational reference**
  back — a relative symlink on POSIX/macOS, a `.lnk` on Windows. `trash` items
  are interned but unreferenced; nothing is deleted.
- **Sessions**: every decision is a transaction in an append-only log
  (`txns[]`), the source of truth from which `folders`/`assignments` are
  replayed. Autosaved to a hidden `.imgsort-session.json` (localStorage
  fallback); powers undo/redo and roll-forward resume. `--no-session` disables.
- `/images` returns paths relative to `process.cwd()` plus an `options` object;
  the generated script has no `cd` and runs from that directory.

## Layout

- `server.js` — the http server + CLI. Imports pure helpers from `lib/`.
- `index.html` — inline CSS + a script that wires the DOM and `import`s pure
  logic from `lib/*.js` (served at `/lib/...`). Not a bundler — native ESM.
- `lib/*.js` — pure, DOM-free, dependency-free modules (hashing, fuzzy match,
  transaction replay, script generation, directory scan / arg parse). This is
  where testable logic lives; keep it free of `document`/`window`/`fs` where
  practical (scan takes `fs` calls as injected params or is tested via a temp
  dir).
- `test/*.test.js` — vitest.

## Checks

All must pass before finishing work:

```
npm run lint        # eslint, **/*.js (lib + test included)
npm run typecheck   # tsc --noEmit, checkJS
npm run format      # prettier --write .  (covers index.html's inline JS)
npm test            # vitest run
```

eslint/tsc do not see `index.html`'s inline script; prettier is its only
automated check. Logic worth testing belongs in `lib/`, not inline.

## Working agreements

- **Never `git add -A` / `git add .`.** Stage the specific files you changed,
  by path. Blanket staging sweeps up incidental churn (e.g. `npm install`
  rewriting `package-lock.json`).
- **Don't chase leftover / incidental files.** If `npm install` or a tool
  leaves unrelated modifications, do not "helpfully" revert, commit, or
  follow up on them unless the user explicitly asks or it directly unblocks
  the task. Be critical about scope; surface it in one line and move on.
- **Rebase, not merge.** Integrate branches with `git rebase` / fast-forward.
  No merge commits.
- **Commit only when asked, and never `git push` without explicit guidance for
  that push** — a commit is not permission to push. Ask or wait each time, even
  right after committing.
- **Pushing is case-by-case.** When there are locally stacked unpushed commits,
  before pushing list each one with a single-sentence descriptor that stays
  close to its actual commit message (a light gloss, not a rewrite), so the
  user can okay the push.
- Early-stage solo project — no PR ceremony; merging straight to `main` is fine
  when the user says so.
- **Delegate implementation to subagents; default to a fresh worktree agent
  per reasonably-grained task, and merge as coordinator.** If you can write a
  self-contained spec for the task (you usually can), it does not need a prior
  agent's history — hand it to a new `isolation: "worktree"` agent, review its
  branch, and rebase/ff it onto the working branch yourself. Repeatedly
  **resuming one long-lived agent balloons its context** (it replays its whole
  transcript each turn) — that is the poor context hygiene delegation is meant
  to avoid; it makes the agent a de facto fork. Only resume the same agent when
  the work is genuinely one continuous thread on an in-flight change that isn't
  yet reviewable. Be deliberate about grain size: split independent pieces
  (a `lib/` helper + test, a CSS animation, a server endpoint) into parallel
  worktree agents rather than serializing them through one. The coordinator
  keeps design decisions, review, and git. Send follow-up requirements before
  an agent finishes; a completed agent may miss a queued message and need an
  explicit resume.
- Match existing style: 4-space indent, single quotes, semicolons. `index.html`
  keeps inline CSS + its DOM-wiring script, but pure logic goes in `lib/*.js`
  (imported by both `index.html` and `server.js`). No build step, and no new
  runtime dependencies, without discussion (dev deps: `vitest` is in).
- **Sensible defaults from context, with a manual override always present**
  (e.g. the macOS/POSIX script tab auto-selects by platform but you can switch).
- **Prefer in-app popups within the app's own z-order over native browser
  dialogs** (`alert` / `confirm` / `prompt`). A general rule of thumb here.
- **The coordinator verifies subagent output before reporting it** — read the
  `git diff` and re-run lint/typecheck/format; don't relay an agent's summary
  on trust.
- **Ask one clarifying question when the design has a real fork**; don't guess
  on decisions that change the shape of the work.
- **"idk" from the user = capture it as a `TODO.md` entry**, don't press for a
  decision or build a guess. Note the sane current behavior alongside the open
  question.
- **Keep responses terse — act, don't survey.** Decisions and diffs over
  essays; skip option-by-option write-ups unless asked.
- **Platform expectations matter.** Match the viewer's OS for things a user
  reads as native — path separators, modifier keys (⌘ on macOS, Ctrl/Win
  elsewhere), download extensions, shell. Detect via `navigator.userAgentData`
  / `navigator.platform`; keep script-bound values (paths in a `sh` script)
  POSIX regardless.
- **Use realpaths for path identity** — resolve (`fs.realpathSync`, or against
  cwd) before comparing, hashing, or keying on a path, so the same location
  addressed differently is treated as one. The scan code already does this.
