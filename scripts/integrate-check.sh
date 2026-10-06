#!/usr/bin/env bash
#
# Mechanical pre-merge checks for one branch, run by /integrate from the main
# checkout. Everything here is something a script decides better than a model
# reading a diff: it is cheap, deterministic, and changes nothing.
#
#   scripts/integrate-check.sh <branch>
#
# Prints one line per check — OK, LOOK (a human should glance at it before
# merging) or STOP (do not merge) — and exits 1 if anything is STOP.

set -euo pipefail

branch="${1:?usage: integrate-check.sh <branch>}"
slug="${branch#*/}"
GIT_COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir)"
manifest="$(dirname "$(dirname "$GIT_COMMON_DIR")")/presto-worktrees/$slug/.worktree"

stop=0
ok()   { printf 'OK    %s\n' "$*"; }
look() { printf 'LOOK  %s\n' "$*"; }
halt() { printf 'STOP  %s\n' "$*"; stop=1; }

git rev-parse --verify --quiet "$branch" >/dev/null || { halt "no such branch: $branch"; exit 1; }

# Conflicts — merge-tree computes the merge without touching the index or the
# working tree, so a conflicted branch can never leave main half-merged.
if conflict_out="$(git merge-tree --write-tree --name-only main "$branch" 2>&1)"; then
  ok "merges cleanly into main"
else
  halt "conflicts with main:"
  printf '%s\n' "$conflict_out" | sed -n '2,/^$/p' | sed '/^$/d; s/^/        /'
fi

# Hard rule: new npm packages need the owner's approval.
added_pkgs="$(node -e '
  const { execSync } = require("child_process")
  const read = (ref) => { try { return JSON.parse(execSync(`git show ${ref}:package.json`, { stdio: ["ignore", "pipe", "ignore"] })) } catch { return {} } }
  const deps = (p) => new Set(Object.keys({ ...p.dependencies, ...p.devDependencies }))
  const base = deps(read(execSync(`git merge-base main ${process.argv[1]}`).toString().trim()))
  console.log([...deps(read(process.argv[1]))].filter((d) => !base.has(d)).join(" "))
' "$branch")"
if [ -n "$added_pkgs" ]; then
  halt "adds npm packages (needs owner approval): $added_pkgs"
else
  ok "no new npm packages"
fi

# Schema: only the branch holding the slot may have applied a migration.
# Migrations go straight to the live project, so the diff can't show them —
# the branch's own log and commit messages are the evidence.
schema="$( { sed -n 's/^SCHEMA=//p' "$manifest" 2>/dev/null || true; } | head -1)"
if [ "$schema" != "owned" ] \
  && { git log main.."$branch" --format=%B; git diff main..."$branch" -- EXECUTIONS.md; } \
     | grep -iqE 'apply_migration|migration `|create table|alter table'; then
  look "mentions a migration but does not own the schema slot (SCHEMA=${schema:-none})"
else
  ok "schema: ${schema:-none}"
fi

# Publishing is live. Anything that could make more things send is the owner's
# call (AGENTS.md "Publishing is LIVE"), so surface it rather than judge it.
publish_hits="$(git diff main..."$branch" -U0 -- . ':!*.md' \
  | grep -E '^\+' | grep -v '^+++' \
  | grep -E 'PRESTO_ENABLE_LIVE_PUBLISH|PUBLISHABLE_PLATFORMS|X_SCOPES|w_member_social|tweet\.write|/rest/posts|ugcPosts|/2/tweets|cron\.schedule|presto-publish-due' || true)"
if [ -n "$publish_hits" ]; then
  look "touches publishing — confirm it doesn't widen what sends:"
  printf '%s\n' "$publish_hits" | head -10 | sed 's/^/        /'
else
  ok "no publishing changes"
fi

if git diff --quiet main..."$branch" -- EXECUTIONS.md; then
  look "no EXECUTIONS.md entry"
else
  ok "EXECUTIONS.md updated"
fi

exit "$stop"
