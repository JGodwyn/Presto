# EXECUTIONS.md — what was done, in order

An append-only log of the steps taken to solve each problem, newest section at
the bottom. It answers "how did this get like this?" — the narrative that
doesn't belong in `LEARNINGS.md` (rules) or `INTERFACE.md` (decisions).

## Format

```
## YYYY-MM-DD — Short task title
**Asked:** one line, in the user's own framing.

- `HH:MM` step taken, in the order it actually happened
- `HH:MM` …

**Verified:** how it was checked — the command, the measurement, the thing looked at.
**Logged:** LEARNINGS.md §… · INTERFACE.md §…   (omit if nothing new)
```

Rules: log **during** the task, not reconstructed after. Record the steps that
actually happened, including the ones that turned out to be wrong — a dead end
is the most useful thing in here. Times are local (WAT).

The `.claude/hooks/task-log-guard.py` hook enforces this: it nudges once a task
crosses 5 changed files and refuses to end the turn until this file is updated.

---

## 2026-08-18 — Project logging system (EXECUTIONS / LEARNINGS / INTERFACE + enforcement hook)
**Asked:** "add a EXECUTIONS.md, LEARNINGS.md, INTERFACE.md … create a hook that
forces you to log this during and after any large task."

- `11:49` Surveyed `.claude/` — found only `settings.local.json` (permissions +
  MCP toggles), no hooks configured, no project `settings.json`. AGENTS.md is
  123KB and loads on every message; its "Current status" section is where
  executions, learnings and interface decisions are currently tangled together.
- `11:52` Wrote `.claude/hooks/task-log-guard.py`, first version counting only
  `Edit`/`Write` tool payloads.
- `11:55` Caught a hole in that: in Bash-first mode the agent's own edits go
  through heredocs and `sed`, which carry no `file_path` — the counter would sit
  at zero through an entire task. Rewrote it to count the **union** of
  tool-reported paths and `git status` paths whose mtime is newer than the
  session baseline. Each alone has a blind spot (tool payloads miss Bash; git
  alone would fire on last week's dirty tree).
- `11:58` Wired three events in a new checked-in `.claude/settings.json`:
  `SessionStart` (reset), `PostToolUse` on `Write|Edit|MultiEdit|NotebookEdit|Bash`
  (one-time "log as you go" nudge at threshold), `Stop` (block until
  EXECUTIONS.md is updated). Gitignored `.claude/.task-log-state/`.
- `12:00` Tested the hook by piping synthetic payloads: silent at 4 files,
  nudges at 5, blocks on `Stop`, stays silent when `stop_hook_active` is set (no
  infinite loop), passes once EXECUTIONS.md's mtime moves, and counts 5 files
  created by plain shell with no tool payload at all. Confirmed the path filter
  rejects the log files themselves, `node_modules/`, `design-sync/`, `.claude/`
  and anything outside the project.
- `12:05` Wrote `INTERFACE.md` — distilled from AGENTS.md's accumulated
  decisions rather than started empty, so a new screen can be built from it
  today: tokens/squircles/type, the component inventory table, layout rules, the
  motion value table, feedback + loading conventions, scrolling, UI persistence,
  content-model conventions, Figma workflow.
- `12:08` Wrote `LEARNINGS.md` — same distillation, as symptom → cause → rule,
  grouped by React / Next.js / CSS / browser runtime / Supabase / AI / tooling /
  browser automation.
- `12:12` Added the pointer section to AGENTS.md so all three are discoverable
  from the file that loads every message.

**Verified:** hook exercised end-to-end with synthetic payloads for every branch
(below threshold, at threshold, blocked, loop-guard, satisfied, Bash-only
detection, path filtering); `settings.json` and the script both parse.
**Logged:** INTERFACE.md (seeded) · LEARNINGS.md (seeded)

---

## 2026-08-18 — Connections: AI models moved out to Settings
**Asked:** "now let's work on the connections panel (this time we'll simplify it
to just connecting social accounts)."

- `12:20` Read the current page: Connections held two cards — the BYOK
  `AiModelsCard` (real, wired to `user_ai_models`) and a "Coming soon" social
  block. Confirmed no Figma export exists for Connections (checked all 50 frames
  in `design-sync/`), and pulled the actual spec from the UX doc §10.3.
- `12:24` Stopped and asked rather than guessing, because three answers would
  each have produced materially different work: where the AI-models card goes,
  how far "connecting social accounts" runs in this pass, and what to style
  against with no frame. Answers: **move models to Settings**, **UI only, no
  DB**, **a frame is coming first**.
- `12:28` `git mv components/connections → components/settings` and
  `connections/model-actions.ts → settings/model-actions.ts`; rewrote the import
  paths, both `revalidatePath` targets (`…/connections` → `…/settings`), and a
  stale comment in `lib/ai/resolve-model.ts` that named the old location.
- `12:31` Settings page became an async server component that fetches the models
  and renders `AiModelsCard` above the existing logout form, with the app's
  standard `@starting-style` mount-in. It kept its old unstyled shadcn classes
  (`text-2xl`, `text-muted-foreground`) — those went with the rewrite.
- `12:33` Connections became a single `EmptyState` placeholder (Plugs icon), with
  the UX §10.3 card anatomy written into a comment so the frame can be built
  against it without re-reading the doc.
- `12:35` Corrected the two now-false Connections bullets in AGENTS.md and added
  one describing the split. First attempt appended it *after* the
  `<!-- END:presto-agent-rules -->` marker — caught and moved inside.

**Verified:** `npx tsc --noEmit` clean; `npx eslint` clean on all three
directories; both moved routes answer 307 (auth redirect, i.e. they compile and
the middleware runs) against the running dev server. **Not** visually verified —
the Chrome extension is disconnected in this session, so the Settings page's new
layout hasn't been looked at.
**Logged:** INTERFACE.md §2 · LEARNINGS.md (nothing new — no surprises in this one)

---

## 2026-08-18 — Connections UI from the Figma exports (LinkedIn)
**Asked:** "for now just build the UI but keep what i said in mind" — the
constraint being: never post or schedule to the real account, even once it
connects. Design supplied as `connect-base` and an updated `social-connected`.

- `13:05` Recorded the publishing constraint in three places before touching
  code — memory, AGENTS.md (as a "Hard constraint" section above "Ask before
  doing these"), and INTERFACE.md §10a — so it outlives this conversation.
- `13:10` Read both exports. `connect-base` is the existing `EmptyState`
  verbatim with a 312px stack of platform rows in its `action` slot — *not* the
  per-platform cards UX doc §10.3 described. `social-connected` had been
  updated since I last read it: it now carries both the account name and the
  expiry, which is what I'd suggested.
- `13:15` Inventoried against existing code before writing any: `EmptyState`,
  `DottedDivider`, Button `brand`/`danger` at `sm`, `surface-4`,
  `surface-success`, `text-success`, `icon-subtle` — all already there. Only
  the brand marks were missing. Confirmed the export's Timer icon is `#77706D`,
  exactly `icon-subtle`, which is the icon-token rule holding up.
- `13:20` Wrote `components/shared/social-icon.tsx` (inline SVG, precedent:
  google-icon.tsx). Checked the existing `/images/generate/linkedin.svg`
  against the export: same mark, different viewBox — so one 20-viewBox copy
  serves both sizes. Left `social-platform-options.tsx` alone rather than
  refactoring it onto this, since that would change how X reads on Generate and
  Content — noted in the component instead.
- `13:25` `types/social-account.ts`, reusing `PostPlatform` from types/post.ts
  rather than adding a third "linkedin" | "x" union. `formatExpiry` went into
  lib/format-date.ts beside the other date formatters.
- `13:30` Built `PlatformRow`, `ConnectedAccountRow` and `ConnectionsPanel`.
  First `cat` failed — `components/connections/` no longer existed, having been
  renamed to `components/settings/` in the previous task.
- `13:40` Couldn't verify visually: the Chrome extension is disconnected and
  the devtools browser has no session, so every project route redirects to
  /login. Rendered the panel through a temporary public route instead. First
  attempt at `app/__preview-connections/` 404'd — a leading underscore makes it
  a Next private folder, excluded from routing. Renamed, screenshotted, deleted.
- `13:45` Two mismatches caught by measuring rather than looking: the X row
  hugged to **40px** where the export is 48 (its action is text, not a 32px
  button), and I'd put stray `pr-pad-sm` on "Coming soon". Fixed by pinning the
  row's content band to `pad-2xl` — the Button sm height — so any action yields
  a 48px row.
- `13:50` The connected row read **"Expires in 61 days"** for a 60-day token —
  `formatExpiry` rounded up, and the two timestamps come from different clocks
  (server `now`, client connect time). Changed to round-to-nearest with a floor
  of one day, which is right for the real flow too.
- `13:55` Removed the preview route, confirmed 404, closed the tab.

**Verified:** in-browser against the exports — base rows **312×48** both, gap
**8**, actions inset **8** from the row's right edge, title **272** with a
**24** gap to the rows; connected block **312×76** over a **312×48** white row,
both squircle-clipped at radius 16, `#fffffe` on `#00a600`, "Expires in 60
days". `formatExpiry` boundaries checked in Node (60d, 60d+3s, 59.6d, 1.4d,
12h, 4h, 0, past). `tsc` and `eslint` clean.
**Logged:** LEARNINGS.md (Next private folders) · INTERFACE.md §2, §10a
