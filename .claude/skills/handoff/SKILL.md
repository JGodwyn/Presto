---
name: handoff
description: Finish a branch — run the quality gates, write the project logs, commit, and mark the branch ready for the senior engineer to review and merge. Use when work on a worktree branch is done, or when the user says /handoff, "wrap this up", "this branch is done", or "hand this off".
---

# /handoff — a branch is done

Run this **inside a worktree**, on its own branch. It prepares the branch for
review; it does **not** merge. Handoff and integration are separate jobs — that
separation is what lets you finish a branch at 11pm and integrate three of them
the next morning.

## 0. Confirm where you are

```bash
git branch --show-current && cat .worktree 2>/dev/null
```

If this is `main` or there is no `.worktree`, stop: `/handoff` is for worktree
branches. On `main` the answer is `/branch` first, or nothing at all.

## 1. Gates, cheapest first

Stop at the first failure and fix it — do not run the rest to collect a full
list, it just costs time.

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

`npm run build` last because it is the slow one. It is not optional: it is the
only gate that exercises Turbopack, server components and the real route tree.

## 2. Logs

The Stop hook already forces `EXECUTIONS.md` on any task of five files or more.
Check the other two deliberately rather than by accident:

- **`EXECUTIONS.md`** — a dated section for this branch: what was asked, the
  steps in the order you actually did them, dead ends included, how it was
  verified.
- **`LEARNINGS.md`** — anything that surprised you, as symptom → cause → rule.
  If nothing surprised you, skip it and say so.
- **`INTERFACE.md`** — any design decision made, written so a future screen can
  be built from it without re-deciding.

These four files merge with the `union` strategy (`.gitattributes`), so
appending to the tail from a branch will not conflict. Append; never restructure
someone else's section.

## 3. Commit

```bash
git add -A
git commit
```

The commit body is the handoff note — the reviewer reads it before the diff:

- what changed, in a paragraph
- what to look at first, and anything deliberately left out
- whether this branch **owns the schema slot**, and what it applied
- anything that will surprise a reviewer (a new pattern, a reverted decision,
  a value tuned by eye)

End the message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## 4. Mark it ready

```bash
git config branch."$(git branch --show-current)".prestoStatus ready
```

This lives in `.git/config`, which is shared across every worktree of the repo —
so `/integrate` in the main checkout sees it, and there is nothing in the working
tree to merge.

## 5. Report

Tell the user: branch name, what landed, gate results, and that it is ready.
Remind them the merge happens when they run `/integrate` from the main checkout —
`/handoff` deliberately does not merge, push, or delete anything.

## Do not

- Do not merge into `main`. That is the senior engineer's job.
- Do not push to origin. Pushing is the user's call.
- Do not mark a branch ready with a failing gate. A red branch marked ready just
  moves the failure to a slower part of the loop.
