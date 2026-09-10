# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Project

`imgsort` is a local, browser-based image-triage tool. A Node http server
(`server.js`, ESM, no framework) serves a single self-contained page
(`index.html` with inline CSS/JS) and the matched image files. Run it with a
glob: `node server.js "**/*.{jpg,jpeg,png,gif,webp}"`, then open
`http://localhost:3000`.

- Sorting model: each image is assigned to a named folder. `uncategorized`
  (default for every image) and `trash` always exist and are reserved; users
  add folders on the fly, assigned via digit keys `1`-`9` (so max 9 folders).
- Nothing touches the filesystem. The results screen generates a shell script
  the user runs themselves — a POSIX `sh` tab (`rm -i` for trash) and a macOS
  tab (`#!/bin/zsh`, `trash` CLI). macOS tab auto-selects by browser platform.
- `/images` returns paths relative to `process.cwd()`; the generated script has
  no `cd` and is meant to be run from that directory, referencing files as
  `./<path>`.

## Checks

All three must pass before finishing work:

```
npm run lint        # eslint, globs **/*.js only
npm run typecheck   # tsc --noEmit, checkJS on *.js only
npm run format      # prettier --write .  (covers index.html's inline JS)
```

eslint/tsc do not see `index.html`; prettier is its only automated check.

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
- **Delegate implementation to subagents** to keep the coordinator's context
  clean — fork or spawn per judgement, worktrees when subtasks are independent.
  The coordinator keeps design decisions, review, and git. Send follow-up
  requirements before the agent finishes; a completed agent may miss a queued
  message and need an explicit resume.
- Match existing style: 4-space indent, single quotes, semicolons. Keep
  `index.html` a single file with inline CSS/JS. No new dependencies and no
  build step without discussion.
- **Sensible defaults from context, with a manual override always present**
  (e.g. the macOS/POSIX script tab auto-selects by platform but you can switch).
- **The coordinator verifies subagent output before reporting it** — read the
  `git diff` and re-run lint/typecheck/format; don't relay an agent's summary
  on trust.
- **Ask one clarifying question when the design has a real fork**; don't guess
  on decisions that change the shape of the work.
- **Keep responses terse — act, don't survey.** Decisions and diffs over
  essays; skip option-by-option write-ups unless asked.
