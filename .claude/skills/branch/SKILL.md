---
name: branch
description: Start a new parallel workstream — creates a branch and its own worktree, wired up with env, Figma exports, deps and its own dev-server port. Use when beginning a task that should not block on whatever else is in flight, or whenever the user says /branch, "new branch", "start a branch for X", or asks to work on something alongside existing work.
---

# /branch — open a parallel workstream

One branch per task you could describe in **one sentence**. If the brief needs
an "and", it is two branches.

## Steps

1. **Get the brief.** Ask the user for the one-sentence purpose if they did not
   already give it with the command. Do not invent one — it is what the senior
   engineer reviews the branch against later.

2. **Work out the slug and type.** Kebab-case, short, names the *area* not the
   change: `connections-oauth`, `content-filters`, `nav-interactions`. Type is
   `feat` (default), `fix`, or `chore`.

3. **Check what is already in flight** before creating anything:

   ```bash
   ./scripts/worktree.sh list
   ```

   Then decide whether this branch collides with a live one:

   - **Shared / hot files** — `components/ui/*`, `lib/*`, `types/*`,
     `app/globals.css`, `hooks/*`, `components/shared/*`. Two live branches both
     editing these will conflict. If one already declares an overlap, say so and
     offer the alternative: run `/integrate` first so this branch starts from a
     `main` that already contains the other work.
   - **A cross-cutting branch** (one whose whole job is shared files — e.g.
     "navigation interactions across the app") should be short-lived and land
     early. Warn if two are open at once.

4. **Does it need a schema change?** Ask if it is not obvious from the brief.
   Migrations apply straight to the live remote Supabase project, so only one
   in-flight branch may own the DB at a time. Check first:

   ```bash
   ./scripts/worktree.sh schema-owner
   ```

   If free and this branch needs it, pass `--schema`. If taken, the branch can
   still be created — it just must not touch the schema, and you should say so
   plainly.

5. **Create it:**

   ```bash
   ./scripts/worktree.sh new <slug> [type] [--schema]
   ```

   This makes the branch off `main`'s tip, the worktree at
   `../presto-worktrees/<slug>`, symlinks `.env.local` / `design-sync/` /
   `.claude/settings.local.json`, clones `node_modules` copy-on-write, and
   assigns a free port from 3001 up.

6. **Record the brief** in the worktree's `.worktree` manifest — the senior
   engineer reads it:

   ```bash
   WT=../presto-worktrees/<slug>
   sed -i '' "s|^PURPOSE=.*|PURPOSE=<the one-sentence brief>|" "$WT/.worktree"
   sed -i '' "s|^HOT_FILES=.*|HOT_FILES=<comma-separated shared paths it expects to touch, or empty>|" "$WT/.worktree"
   ```

7. **Hand it over.** Print the path, the branch, and the port, e.g.:

   > `feat/connections-oauth` is ready at `../presto-worktrees/connections-oauth`,
   > port **3002**. Open a session there: `cd ../presto-worktrees/connections-oauth && claude`
   > Run the dev server with `npm run dev -- -p 3002`.

   **Say the port out loud.** Verification here is browser-driven, and
   screenshotting port 3000 while your change is on 3002 is the single easiest
   way to conclude a working change is broken.

## Do not

- Do not start working in the new worktree from this session. `/branch` opens
  it; the user opens a session there. Working on it here defeats the point.
- Do not create a branch off anything but `main`.
- Do not create a second `--schema` branch while one is open. The script
  refuses, and that refusal is correct.
