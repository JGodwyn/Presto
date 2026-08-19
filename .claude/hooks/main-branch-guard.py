#!/usr/bin/env python3
"""Keeps source edits off `main` — the branch-protection half of the parallel
workflow (see AGENTS.md, "Parallel work").

Wired as a PreToolUse hook on the file-writing tools. If the current branch is
`main` and the target is a source file, the edit is denied with a pointer at
/branch. Everything else is allowed:

  - any branch other than main (worktrees are always on their own branch)
  - docs, project logs and tooling config, which are not what branches isolate
  - PRESTO_ALLOW_MAIN=1 in the environment, for the genuine one-line fix

Fails OPEN: if git is unavailable or anything here goes wrong, the edit is
allowed. A guard that blocks work because it could not read git is worse than
no guard.
"""

import json
import os
import subprocess
import sys

# Directories whose contents belong on a branch.
GUARDED_PREFIXES = ("app/", "components/", "lib/", "hooks/", "types/", "design-tokens/")

# Free to edit on main: the append-only logs (they use a union merge strategy
# precisely so branches can all touch them), agent config, and repo tooling.
EXEMPT_PREFIXES = (".claude/", ".agents/", "scripts/", "public/")
EXEMPT_NAMES = (
    "EXECUTIONS.md", "LEARNINGS.md", "INTERFACE.md", "AGENTS.md", "CLAUDE.md",
    "README.md", ".gitignore", ".gitattributes", "package.json",
    "package-lock.json", "tsconfig.json",
)

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


def current_branch():
    out = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=PROJECT_DIR, capture_output=True, text=True, timeout=5,
    )
    return out.stdout.strip()


def is_guarded(path):
    if not path:
        return False
    absolute = path if os.path.isabs(path) else os.path.join(PROJECT_DIR, path)
    relative = os.path.relpath(absolute, PROJECT_DIR).replace(os.sep, "/")
    if relative.startswith("../"):        # outside the repo entirely
        return False
    if os.path.basename(relative) in EXEMPT_NAMES:
        return False
    if any(relative.startswith(p) for p in EXEMPT_PREFIXES):
        return False
    return any(relative.startswith(p) for p in GUARDED_PREFIXES)


def main():
    payload = json.load(sys.stdin)

    if os.environ.get("PRESTO_ALLOW_MAIN"):
        return
    if current_branch() != "main":
        return

    path = (payload.get("tool_input") or {}).get("file_path")
    if not is_guarded(path):
        return

    relative = os.path.relpath(path, PROJECT_DIR)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"`{relative}` is a source file and you are on `main`. Source work "
                "goes on a branch so it can be reviewed and merged independently "
                "(AGENTS.md, \"Parallel work\").\n\n"
                "Run `/branch <slug>` to open a worktree for this task, then work "
                "there. For a genuine one-line fix that is not worth a branch, "
                "re-run with PRESTO_ALLOW_MAIN=1 set."
            ),
        }
    }))


if __name__ == "__main__":
    # Fail open — never let this hook be the reason work cannot proceed.
    try:
        main()
    except Exception:
        pass
