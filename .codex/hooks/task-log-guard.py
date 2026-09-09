#!/usr/bin/env python3
"""Forces the three project logs to be written for any large task.

Wired into Claude Code as three hook events (see .claude/settings.json):

  post-tool-use  after every file-touching tool call, re-counts the files this
                 task has changed; once it crosses LARGE_TASK_FILES it injects a
                 one-time "log as you go" reminder (the *during* half).
  stop           refuses to end the turn while a large task has gone by without
                 EXECUTIONS.md being updated (the *after* half).
  session-start  clears this session's counters.

Changed files are counted two ways, because either one alone has a blind spot:
the tool payload names the file for Write/Edit, but says nothing useful for a
Bash heredoc or `sed -i`; `git status` sees every one of those, but also sees
work left dirty by earlier sessions. The union of (paths this session's tools
reported) and (dirty paths whose mtime is newer than this session's baseline)
is what counts.

State is per-session and disposable, so a stale file can never wedge a session:
anything unreadable is treated as "no task in progress".
"""

import json
import os
import subprocess
import sys
import time

# A task counts as "large" at this many distinct source files changed.
LARGE_TASK_FILES = int(os.environ.get("PRESTO_LARGE_TASK_FILES", "5"))

LOG_FILES = ("EXECUTIONS.md", "LEARNINGS.md", "INTERFACE.md")
REQUIRED_LOG = "EXECUTIONS.md"

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
STATE_DIR = os.path.join(PROJECT_DIR, ".claude", ".task-log-state")

# Paths that are noise for this purpose: the logs themselves, agent config,
# scratch space, build output, dependencies.
IGNORED_PARTS = (
    "/.claude/", "/.agents/", "/node_modules/", "/.next/", "/scratchpad/",
    "/design-sync/", "/.git/",
)


def state_path(session_id):
    safe = "".join(c for c in (session_id or "nosession") if c.isalnum() or c in "-_")
    return os.path.join(STATE_DIR, f"{safe or 'nosession'}.json")


def fresh_state():
    return {"touched": [], "baseline": time.time(), "nudged": False}


def read_state(session_id):
    try:
        with open(state_path(session_id)) as f:
            state = json.load(f)
        # Any shape but the expected one means start over rather than crash.
        return state if isinstance(state.get("touched"), list) else fresh_state()
    except Exception:
        return fresh_state()


def write_state(session_id, state):
    os.makedirs(STATE_DIR, exist_ok=True)
    tmp = state_path(session_id) + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, state_path(session_id))


def logs_written_since(baseline):
    """Which of the three logs have been modified since the task started."""
    written = []
    for name in LOG_FILES:
        try:
            if os.path.getmtime(os.path.join(PROJECT_DIR, name)) > baseline:
                written.append(name)
        except OSError:
            pass
    return written


def is_source_file(path):
    if not path:
        return False
    absolute = path if os.path.isabs(path) else os.path.join(PROJECT_DIR, path)
    if os.path.basename(absolute) in LOG_FILES:
        return False
    normalized = "/" + os.path.relpath(absolute, PROJECT_DIR).replace(os.sep, "/")
    if normalized.startswith("/../"):  # outside the project entirely
        return False
    return not any(part in normalized for part in IGNORED_PARTS)


def dirty_since(baseline):
    """Working-tree paths whose contents changed after this session started."""
    try:
        out = subprocess.run(
            ["git", "status", "--porcelain", "-z", "--untracked-files=all"],
            cwd=PROJECT_DIR, capture_output=True, text=True, timeout=5,
        ).stdout
    except Exception:
        return []

    paths = []
    entries = [e for e in out.split("\0") if e]
    skip_next = False
    for entry in entries:
        if skip_next:  # renames emit the old path as its own entry
            skip_next = False
            continue
        status, _, path = entry[:2], entry[2:3], entry[3:]
        if "R" in status:
            skip_next = True
        absolute = os.path.join(PROJECT_DIR, path)
        try:
            if os.path.getmtime(absolute) <= baseline:
                continue
        except OSError:
            continue
        if is_source_file(absolute):
            paths.append(absolute)
    return paths


def changed_files(state):
    seen, union = set(), []
    for path in list(state.get("touched", [])) + dirty_since(state.get("baseline", 0)):
        if path not in seen:
            seen.add(path)
            union.append(path)
    return union


def handle_post_tool_use(payload):
    session_id = payload.get("session_id")
    state = read_state(session_id)

    # A log write closes the current round: the work up to here is recorded,
    # so the next batch of changes starts counting from zero.
    if logs_written_since(state["baseline"]):
        state = fresh_state()

    path = (payload.get("tool_input") or {}).get("file_path")
    if is_source_file(path) and path not in state["touched"]:
        state["touched"].append(path)

    count = len(changed_files(state))
    if count >= LARGE_TASK_FILES and not state["nudged"]:
        state["nudged"] = True
        write_state(session_id, state)
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": (
                    f"[task-log] This task has now changed {count} files, so it counts as a "
                    "large task. Append your steps to EXECUTIONS.md as you go — don't wait "
                    "until the end and reconstruct them. Add to LEARNINGS.md the moment "
                    "something surprises you, and to INTERFACE.md the moment a design "
                    "decision is made."
                ),
            }
        }))
        return

    write_state(session_id, state)


def handle_stop(payload):
    # Claude is already responding to a previous block from this hook; never
    # block twice in a row or the turn could never end.
    if payload.get("stop_hook_active"):
        return

    session_id = payload.get("session_id")
    state = read_state(session_id)
    changed = changed_files(state)
    if len(changed) < LARGE_TASK_FILES:
        return

    if REQUIRED_LOG in logs_written_since(state.get("baseline", 0)):
        write_state(session_id, fresh_state())
        return

    listed = "\n".join(f"  - {os.path.relpath(p, PROJECT_DIR)}" for p in changed[:12])
    if len(changed) > 12:
        listed += f"\n  - …and {len(changed) - 12} more"

    reason = (
        f"This task changed {len(changed)} files but EXECUTIONS.md was not updated. "
        "Write the logs before finishing:\n\n"
        f"{listed}\n\n"
        "1. EXECUTIONS.md (required) — append a dated section for this task: what was "
        "asked, the steps in the order you actually did them with timestamps, and how it "
        "was verified.\n"
        "2. LEARNINGS.md (if anything surprised you) — the symptom, the root cause, the "
        "rule that stops it recurring. One entry per learning, not a narrative.\n"
        "3. INTERFACE.md (if any design decision was made) — the decision and its "
        "rationale, written so a future UI can be built from it without re-deciding.\n\n"
        "Skip 2 and 3 only if there is genuinely nothing new to record. Then finish your "
        "reply as normal."
    )
    print(json.dumps({"decision": "block", "reason": reason}))


def handle_session_start(payload):
    write_state(payload.get("session_id"), fresh_state())


def main():
    event = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return

    handler = {
        "post-tool-use": handle_post_tool_use,
        "stop": handle_stop,
        "session-start": handle_session_start,
    }.get(event)
    if handler:
        handler(payload)


if __name__ == "__main__":
    # A crash here must never take a tool call or a turn down with it.
    try:
        main()
    except Exception:
        pass
