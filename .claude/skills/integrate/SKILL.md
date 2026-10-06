---
name: integrate
description: Merge every branch marked ready into main — conflict probe and hard-rule checks per branch, merge, then one set of gates on the merged result. Runs inline, no subagent. Use when the user says /integrate, "merge the branches", "integrate what's ready", or is about to start a branch that overlaps something in flight. `/integrate review` adds a /code-review pass per branch.
---

# /integrate — land what's ready

Runs in the **main checkout**, in this session. No subagent: the expensive part
of integration is a build, and the only build that can catch an integration bug
is one run on the *merged* `main` — so that is the one build this does.

Each branch's own session already ran tsc/lint/test/build under `/handoff`.
Re-running them in the branch's worktree tests the branch against an old
`main`, which can't find anything integration exists to find.

## 1. Preflight

```bash
git branch --show-current    # must be main
git status --porcelain       # must be empty
git rev-parse --short HEAD   # remember this: it is the undo point
./scripts/worktree.sh list
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/ | grep -v '^main$'); do
  printf '%s\t%s\n' "$b" "$(git config --get "branch.$b.prestoStatus" || echo wip)"
done
```

- Not on `main`, or dirty → stop and say so.
- No `ready` branches → say which are `wip` and stop.
- `wip` branches are left alone entirely.

## 2. Order

Shared-file branches first (`components/ui/*`, `components/shared/*`, `lib/*`,
`types/*`, `hooks/*`, `app/globals.css`), then the schema-owning branch, then
the rest smallest-diff first. `git diff --stat main...<branch>` is enough to
decide; don't read whole diffs for this.

## 3. Per branch, in that order

```bash
./scripts/integrate-check.sh <branch>
```

It probes conflicts with `git merge-tree` (touches nothing) and checks the hard
rules a script judges better than a read-through: new npm packages, migrations
from a branch without the schema slot, anything touching publishing, a missing
EXECUTIONS.md entry.

- **STOP** → skip this branch, change nothing, report the output. A conflict is
  the user's to resolve; never resolve one yourself.
- **LOOK** → read just the lines it printed (and the hunk around them). Publishing
  changes that widen what sends are the owner's call — skip and ask.
- **All OK** → merge:

```bash
git merge --no-ff <branch> -m "Merge <branch>: <one line on what it delivered>"
```

Re-run the check for each later branch *after* the previous merge — `main` has
moved, and a branch that merged cleanly against the old tip can conflict with
the new one.

**`/integrate review`** only: before merging, run `/code-review` on
`main...<branch>` and fold real findings into the report. Off by default — the
branch's own session built and verified it, and a per-branch review pass is the
single most expensive thing this skill could do.

## 4. Gates, once, on the merged main

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Stop at the first failure. Report the output and the undo point from step 1
(`git reset --hard <sha>` drops every merge from this run — nothing has been
pushed). Say which merged branch the failure most likely belongs to; don't fix
it on `main` unless asked.

## 5. Tidy and clean up

The four log files merge with `union`, which never conflicts and so never warns
about an exact duplicated line. One cheap check:

```bash
for f in EXECUTIONS.md LEARNINGS.md INTERFACE.md AGENTS.md; do
  git diff <undo-sha>..HEAD -- "$f" | grep '^+[^+]' | grep -v '^+\s*$' | sort | uniq -d
done
```

Only if that prints something: remove the duplicate and commit it as a separate
`chore: tidy union-merged logs`.

Then, per merged branch: `./scripts/worktree.sh remove <slug>`. It refuses a
dirty tree and uses `git branch -d`, which refuses unmerged work — both
refusals are correct; never work around them.

## Report

| Branch | Checks | Merged |
|---|---|---|

Then: gate result on merged `main`, anything skipped and why, live worktrees now
behind `main`, and whether the schema slot is free
(`./scripts/worktree.sh schema-owner`). Short.

## Hard limits

- Never `git branch -D`, never force anything, never resolve a conflict.
- Never push. `main` deploys to production on push — that is the user's call.
- Never apply a migration or touch the database.
- Never edit a branch's code to make a check or gate pass.
