---
name: integrate
description: Review every branch marked ready, merge the ones that pass, delete what is spent, and flag conflicts and failures for the user to resolve. Runs the senior-engineer agent. Use when the user says /integrate, "merge the branches", "integrate what's ready", or is about to start a branch that overlaps something in flight.
---

# /integrate — land what's ready

Hands every `ready` branch to the **senior-engineer** agent, which reviews,
merges the clean ones, deletes what is spent, and escalates the rest.

## When to run this

- **A branch just finished** and you want it in `main`.
- **Before opening a branch that overlaps something in flight**, so the new one
  starts from a `main` that already contains the other work instead of racing it.
- **End of a work session**, to leave `main` whole.

Not on a timer, and not while a branch is still moving — reviewing work in
progress wastes everyone's time.

## Preflight — do this yourself, before spawning anything

```bash
git branch --show-current    # must be main
git status --porcelain       # must be empty
./scripts/worktree.sh list
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/ | grep -v '^main$'); do
  printf '%s\t%s\n' "$b" "$(git config --get "branch.$b.prestoStatus" || echo wip)"
done
```

- Not on `main`, or `main` is dirty → **stop and say so.** Do not merge into a
  dirty tree.
- No `ready` branches → say which branches are still `wip` and stop. There is
  nothing to integrate; spawning the agent to discover that wastes a cold start.

## Run it

Spawn the **senior-engineer** agent (`subagent_type: "senior-engineer"`) with:

- the list of `ready` branches and their slugs
- each one's `.worktree` manifest (`PURPOSE`, `HOT_FILES`, `SCHEMA`)
- the current `main` HEAD
- which branches are still `wip`, so it leaves them alone

One agent for the whole sweep, not one per branch: merge order is a judgment
call that needs to see all the candidates at once, and each merge moves `main`
under the others.

Running it as a subagent also keeps the task-log `Stop` hook out of the way — a
conflicted merge leaves enough dirty files to trip it, and `Stop` does not fire
for subagents.

## Afterwards

Relay the agent's report — it is not shown to the user. Keep the table, keep the
detail for anything that did not merge, and keep the closing two lines (which
worktrees are behind `main`, whether the schema slot is free).

If a branch was flagged for a **conflict**, that is now the user's to resolve:

```bash
git merge --no-ff <branch>      # in the main checkout, when they're ready
# resolve, then:
git add <files> && git commit
```

Offer to help with the resolution if they want it — but only after they have
seen what disagrees, and only when they ask. Do not resolve it pre-emptively.

Pushing to origin stays the user's call. Mention that `main` has moved and leave
it there.
