#!/usr/bin/env bash
#
# Parallel-branch plumbing for Presto. Deterministic shell the /branch,
# /handoff and /integrate skills call, so those stay thin prose instead of
# re-deriving git incantations every time.
#
#   worktree.sh new <slug> [type] [--schema]   create branch + worktree
#   worktree.sh list                           every worktree, port and state
#   worktree.sh remove <slug> [--force]        safe teardown
#   worktree.sh schema-owner                   print the branch owning the DB slot
#
# Worktrees live OUTSIDE the repo (../presto-worktrees/<slug>) on purpose: a
# worktree nested inside would be walked by `next build`, eslint and vitest
# globs, silently duplicating every file in the project.

set -euo pipefail

# --- locate the main checkout ------------------------------------------------
# --show-toplevel would give the *worktree* root when run from inside one.
# --git-common-dir always points at the main checkout's .git, whichever
# worktree we are standing in.
GIT_COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir)"
MAIN_ROOT="$(dirname "$GIT_COMMON_DIR")"
WORKTREE_HOME="$(dirname "$MAIN_ROOT")/presto-worktrees"
BASE_PORT=3001

# Gitignored but required to run. A fresh worktree has none of these, and
# without them: no dev server (.env.local), no Figma exports (design-sync),
# a permission prompt for every tool call (settings.local.json).
#
# These three are symlinked rather than copied so an edited .env.local or a
# newly exported Figma frame is visible from every worktree immediately.
# node_modules deliberately is NOT in this list — see clone_deps().
LINKED=(
  ".env.local"
  "design-sync"
  ".claude/settings.local.json"
)

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m%s\033[0m %s\n' "$1" "${2-}"; }

usage() {
  sed -n '3,17p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

# --- shared helpers ----------------------------------------------------------

wt_path()   { printf '%s/%s' "$WORKTREE_HOME" "$1"; }
wt_file()   { printf '%s/.worktree' "$(wt_path "$1")"; }

# Read one KEY from a worktree's .worktree manifest.
wt_get() {
  local slug="$1" key="$2" file
  file="$(wt_file "$slug")"
  [ -f "$file" ] || return 0
  sed -n "s/^${key}=//p" "$file" | head -1
}

# Every slug that currently has a worktree directory.
all_slugs() {
  [ -d "$WORKTREE_HOME" ] || return 0
  find "$WORKTREE_HOME" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
}

# Lowest port from BASE_PORT that no worktree claims and nothing is listening on.
free_port() {
  local port=$BASE_PORT claimed slug
  claimed=" $(for slug in $(all_slugs); do wt_get "$slug" PORT; done | tr '\n' ' ') "
  while true; do
    if [[ "$claimed" != *" $port "* ]] && ! lsof -i ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
      printf '%s' "$port"; return
    fi
    port=$((port + 1))
  done
}

# The branch currently holding the schema slot, if any. Schema changes are
# serialized: migrations go straight to the live remote Supabase project, so
# two branches changing the DB at once means main can end up with code that
# only works because of an unmerged branch.
schema_owner() {
  local slug
  for slug in $(all_slugs); do
    if [ "$(wt_get "$slug" SCHEMA)" = "owned" ]; then
      printf '%s' "$(wt_get "$slug" BRANCH)"; return
    fi
  done
}

# node_modules cannot be a symlink: Turbopack (the Next 16 default) rejects one
# pointing outside the project root outright — "Symlink [project]/node_modules
# is invalid, it points out of the filesystem root" — and takes `next dev` down
# with a panic. tsc and vitest resolve through it fine, so the breakage only
# shows when you try to run the app.
#
# An APFS clone is the way out: copy-on-write, so it takes ~10s and shares the
# blocks with the main checkout instead of spending another 657 MB. It is a real
# copy as far as the toolchain is concerned, which is what Turbopack wants.
clone_deps() {
  local path="$1"
  [ -d "$MAIN_ROOT/node_modules" ] || { printf '\033[33mwarn:\033[0m no node_modules in main checkout — run npm install in the worktree\n' >&2; return 0; }
  info "deps" "cloning node_modules (copy-on-write)…"
  if ! cp -Rc "$MAIN_ROOT/node_modules" "$path/node_modules" 2>/dev/null; then
    # Not APFS, or cross-volume: fall back to a plain copy.
    cp -R "$MAIN_ROOT/node_modules" "$path/node_modules"
  fi
}

# --- new ---------------------------------------------------------------------

cmd_new() {
  local slug="${1-}" type="${2-feat}" schema="none"
  [ -n "$slug" ] || usage
  [[ "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "slug must be kebab-case: '$slug'"
  case "${3-}" in --schema) schema="owned" ;; "") ;; *) die "unknown flag: $3" ;; esac

  local branch="$type/$slug" path
  path="$(wt_path "$slug")"

  [ -e "$path" ] && die "worktree already exists: $path"
  git -C "$MAIN_ROOT" show-ref --verify --quiet "refs/heads/$branch" \
    && die "branch already exists: $branch"

  if [ "$schema" = "owned" ]; then
    local owner; owner="$(schema_owner)"
    [ -n "$owner" ] && die "schema slot is taken by '$owner' — it must merge first.
Migrations apply to the live remote Supabase project, so only one in-flight
branch may change the schema at a time."
  fi

  # Branch from main's tip, not from wherever HEAD happens to be.
  git -C "$MAIN_ROOT" show-ref --verify --quiet refs/heads/main || die "no main branch"
  mkdir -p "$WORKTREE_HOME"
  git -C "$MAIN_ROOT" worktree add -b "$branch" "$path" main >/dev/null
  info "branch" "$branch"
  info "worktree" "$path"

  # Link the four gitignored-but-required things back to the main checkout.
  # Symlinks, not copies: a new Figma export or an edited .env.local should be
  # visible from every worktree immediately.
  local item target
  for item in "${LINKED[@]}"; do
    target="$MAIN_ROOT/$item"
    if [ -e "$target" ]; then
      mkdir -p "$(dirname "$path/$item")"
      ln -s "$target" "$path/$item"
    else
      printf '\033[33mwarn:\033[0m %s missing in main checkout, not linked\n' "$item" >&2
    fi
  done
  info "linked" "${LINKED[*]}"

  clone_deps "$path"

  local port; port="$(free_port)"
  cat > "$path/.worktree" <<EOF
# Written by scripts/worktree.sh — gitignored, per-worktree.
SLUG=$slug
BRANCH=$branch
PORT=$port
SCHEMA=$schema
CREATED=$(date -u +%Y-%m-%dT%H:%M:%SZ)
PURPOSE=
HOT_FILES=
EOF
  info "port" "$port  (npm run dev -- -p $port)"
  [ "$schema" = "owned" ] && info "schema" "this branch owns the DB slot"

  printf '\nOpen a session there with:\n  cd %s && claude\n' "$path"
}

# --- list --------------------------------------------------------------------

cmd_list() {
  local slugs; slugs="$(all_slugs)"
  if [ -z "$slugs" ]; then echo "no worktrees — only the main checkout at $MAIN_ROOT"; return; fi

  printf '%-18s %-26s %-6s %-8s %-9s %s\n' SLUG BRANCH PORT STATE AHEAD/BEH NOTES
  local slug branch port state counts dirty notes
  for slug in $slugs; do
    branch="$(wt_get "$slug" BRANCH)"
    port="$(wt_get "$slug" PORT)"

    state="$(git -C "$MAIN_ROOT" config --get "branch.$branch.prestoStatus" || echo wip)"
    counts="$(git -C "$MAIN_ROOT" rev-list --left-right --count "main...$branch" 2>/dev/null || echo '? ?')"
    dirty="$(git -C "$(wt_path "$slug")" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

    notes=""
    [ "$dirty" != "0" ] && notes="$dirty dirty"
    [ "$(wt_get "$slug" SCHEMA)" = "owned" ] && notes="${notes:+$notes, }schema"
    # left = commits on main the branch lacks, right = commits the branch adds.
    printf '%-18s %-26s %-6s %-8s %-9s %s\n' \
      "$slug" "$branch" "$port" "$state" \
      "$(echo "$counts" | awk '{print $2"/"$1}')" "$notes"
  done
}

# --- remove ------------------------------------------------------------------

cmd_remove() {
  local slug="${1-}" force="${2-}"
  [ -n "$slug" ] || usage
  local path branch
  path="$(wt_path "$slug")"
  [ -d "$path" ] || die "no such worktree: $path"
  branch="$(wt_get "$slug" BRANCH)"

  local dirty
  dirty="$(git -C "$path" status --porcelain | wc -l | tr -d ' ')"
  [ "$dirty" != "0" ] && die "$slug has $dirty uncommitted change(s) — commit or discard first"

  # Refuse before touching anything if the branch still holds work that is not
  # in main. The commits would survive on the branch, but tearing down the
  # working directory of unfinished work is not what "remove" should mean.
  if [ -n "$branch" ] && [ "$force" != "--force" ]; then
    if ! git -C "$MAIN_ROOT" merge-base --is-ancestor "$branch" main 2>/dev/null; then
      die "$branch is not merged into main — nothing removed.
Run /integrate to land it, or re-run with --force to discard the worktree
(the branch and its commits are kept either way)."
    fi
  fi

  git -C "$MAIN_ROOT" worktree remove "$path"
  info "removed" "$path"

  if [ -n "$branch" ]; then
    # -d, never -D: it refuses a branch whose work is not in main, which is
    # exactly the guard we want. An unmerged branch is a conversation.
    if git -C "$MAIN_ROOT" branch -d "$branch" >/dev/null 2>&1; then
      info "deleted" "$branch"
    else
      printf '\033[33mkept:\033[0m %s is not fully merged into main — branch left in place\n' "$branch"
    fi
  fi
}

# --- dispatch ----------------------------------------------------------------

case "${1-}" in
  new)          shift; cmd_new "$@" ;;
  list)         shift; cmd_list "$@" ;;
  remove)       shift; cmd_remove "$@" ;;
  schema-owner) owner="$(schema_owner)"; [ -n "$owner" ] && echo "$owner" || echo "(free)" ;;
  *)            usage ;;
esac
