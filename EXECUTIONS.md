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

## 2026-08-19 — Parallel branch workflow + senior engineer agent
**Asked:** "simulate a real programming set up in companies" — work on several
parts of the project at once in branches, with a senior engineer agent that
checks branches when work's done, merges the ones that check out, deletes stale
branches, and flags merge conflicts to resolve by hand.

- `07:05` Surveyed the repo for what parallelism would actually cost here. Four
  findings shaped everything after: migrations go straight to the **live remote
  Supabase project** (no local `supabase/` dir, so schema is global state
  branches cannot isolate); `.env.local`, `design-sync/` and
  `.claude/settings.local.json` are gitignored, so a fresh worktree has none of
  them; `EXECUTIONS/LEARNINGS/INTERFACE.md` were untracked; nothing in source
  hardcodes `localhost:3000`, so per-worktree ports are safe.
- `07:10` Asked the four decisions that change the shape of the thing. Answers:
  serialize schema changes rather than pay for Supabase branching; local
  `--no-ff` merges rather than PRs; the agent merges when green and stops when
  not; and the workflow has to be there when wanted and invisible when not.
- `07:15` **Phase 0.** Committed the 29 accumulated dirty files as the baseline
  (`e526b64`) — worktrees branch from a commit, so anything left uncommitted
  strands in the main checkout. Tracked the three logs in the same commit.
  Added `__pycache__/` to `.gitignore` first; it was about to be swept in.
- `07:16` `.gitattributes` with `merge=union` on the four append-only docs.
  Without it every merge conflicts, because every branch appends to the same
  tail.
- `07:17` Wrote `scripts/worktree.sh` (`new` / `list` / `remove` /
  `schema-owner`). Locates the main checkout via `--git-common-dir` rather than
  `--show-toplevel`, which would return the *worktree* root when run inside one.
- `07:18` First worktree came up dirty on a `design-sync` symlink: `/design-sync/`
  in `.gitignore` has a trailing slash, which matches a real directory but not a
  symlink to one. Dropped the slash.
- `07:19` `tsc --noEmit` clean and all 56 vitest tests passed in the worktree —
  the symlinked `node_modules` looked fine.
- `07:20` **It was not fine.** `next dev` panicked: *"Symlink
  [project]/node_modules is invalid, it points out of the filesystem root"*.
  Turbopack rejects it outright. Every cheap check passing is what makes this
  one nasty. Replaced the symlink with an APFS copy-on-write clone (`cp -Rc`,
  ~10s, blocks shared) — dev server then came up in 322ms and served a real
  middleware redirect on its own port. The other three stay symlinks.
- `07:25` Wrote the three skills (`/branch`, `/handoff`, `/integrate`) and
  `.claude/agents/senior-engineer.md`. Split deliberately: `/handoff` prepares a
  branch and never merges; `/integrate` merges and never resolves a conflict.
- `07:30` Added `.claude/hooks/main-branch-guard.py` (PreToolUse) — denies source
  edits on `main`, exempts docs/logs/tooling, escape hatch `PRESTO_ALLOW_MAIN=1`,
  fails open if git is unreadable.
- `07:35` Added the "Parallel work" section to AGENTS.md.

**Verified:** worktree created, `tsc`/`lint`/`test`/`build` run inside it, dev
server booted on :3001 and answered; teardown via `worktree.sh remove` refused a
dirty tree as designed; guard hook denies `components/ui/button.tsx` on main,
allows `EXECUTIONS.md`, and allows under `PRESTO_ALLOW_MAIN=1`. Two-branch merge
and deliberate-conflict rehearsal: see the follow-up entry below.
**Logged:** LEARNINGS.md §Git worktrees

## 2026-08-19 — Parallel workflow: verification rehearsal
**Asked:** prove the branch/merge machinery works before trusting it with real
work.

- `07:40` Two clean parallel worktrees (`scratch-a`/`scratch-b`, ports 3001/3002,
  0 dirty each, all 54 Figma exports visible through the symlink). Distinct
  source files in each, plus an appended `EXECUTIONS.md` section in both — the
  union-merge test.
- `07:42` `git config branch.<b>.prestoStatus ready` set from *inside* a worktree
  was readable from the main checkout, confirming `.git/config` is shared across
  worktrees and needs nothing merged.
- `07:44` Both merged `--no-ff`. `EXECUTIONS.md` came out with both entries and
  **zero conflict markers** — but with the blank line between them collapsed.
  That is exactly the union-strategy caveat, and why the senior engineer tidies
  the merged tail as part of the merge.
- `07:46` **The finding that justifies the agent's re-probe.** For the conflict
  rehearsal, `scratch-c` and `scratch-d` both edited the same line.
  `git merge-tree --write-tree` reported **both CLEAN against the original
  `main`**; `scratch-d` only conflicted once `scratch-c` had merged. A single
  up-front probe would have declared both safe. Hence: re-run the probe and the
  gates against the new `main` after *every* merge, never trust the first pass.
- `07:48` With `d` conflicted: `main` stayed clean and carried only `c`'s
  content, and `d`'s branch and worktree were untouched. Resolved by hand in the
  main checkout, committed, merged.
- `07:50` **Bug found in teardown.** `remove` tore down the worktree of an
  unmerged branch — `git branch -d` correctly refused the branch, but the working
  directory was already gone. Added a `merge-base --is-ancestor` check that
  refuses *before* touching anything, with `--force` as the deliberate override.
  Re-tested: refused.
- `07:52` Schema serialization: a second `--schema` branch is refused while one
  is open, a non-schema branch alongside it is created normally, and `list`
  marks who holds the slot.
- `07:54` Removed all rehearsal worktrees and reset `main` back to `a81e1c4`, so
  none of the scratch files or merge commits stay in history.

**Verified:** as above — union merge (2 entries, 0 markers), conflict detection
before/after an intervening merge, `main` untouched by a conflicted branch,
hand-resolution, unmerged-branch and dirty-tree refusals, schema-slot refusal,
and full teardown back to `main` alone.

## 2026-08-20 — Generate: empty-batch exit + restart edits in place

Two items, both in `components/generate/generating-view.tsx`.

- `14:00` **Restart was inserting a second post onto every day it had already
  scheduled.** `handleRestart` cleared `posts` client-side and reset
  `generatedSoFar` to 0, but the batch loop only knows one verb —
  `generateAndSavePost`, an INSERT — so the previous run's rows were orphaned in
  the DB and a fresh set landed on the same dates. Confirmed against the live
  DB before touching anything: `Design content` had duplicate pairs sharing a
  `scheduled_for` down to the second (2027-03-02, -03-09, -03-24, …), each pair
  a restart from an earlier session.
- `14:02` Fix: `GeneratedPost` gained `batchIndex` (the loop slot that produced
  it, *not* its position in `posts`, which shifts on delete), and
  `restartTargetsRef` maps slot → post id, captured by `handleRestart` from
  whatever is still on screen. The loop consults it per index and calls
  `regeneratePost` (an UPDATE, keeping id/date/platform) where a row exists,
  falling back to `generateAndSavePost` where it doesn't. Reusing
  `regeneratePost` also gets the "different angle from `previousContent`"
  framing for free, which is what a restart wants anyway. Resume is untouched —
  it's the same run carrying on, so the map stays.
- `14:05` **Deleting the last post left you on an empty grid** with a Restart
  button for a batch that no longer existed. Added an effect that calls
  `goBack()` once the grid empties, gated on three things: `status ===
  "completed"` (a running batch has more cards coming), `hasDeletedRef` (a
  total-failure batch also has zero posts, and it owns the "Nothing to show"
  modal), and `deletesInFlight === 0` (a refused delete restores its card
  instead of navigating away from a post that still exists). `goBack` became a
  `useCallback` so the effect isn't re-entered every render.
- `14:06` Dead end worth recording: an `InvalidStateError: Transition was
  aborted` kept showing in the console mid-verification. Not the feature — it
  was the test harness setting `location.href` while React's ViewTransition was
  still running the client-side push. Re-ran the same sequence patiently
  (clicks + waits, no forced navigation) and it never appeared, on either build.

**Verified** in-browser on :3003 with the TasteTest model and a calendar-based
2-post batch, checking the DB after each step:
- Two restarts in a row: same two row ids, same `created_at`, same
  `scheduled_for`, content rerolled each time. No new rows.
- Delete one card, then Restart: the surviving day's row was rerolled in place
  (`created_at` unchanged) and the deleted day got a fresh insert — one post per
  day either way, which is the fallback branch doing its job.
- Delete the last card: lands on `/generate` with the Number/Calendar control,
  both rows gone from the DB, no console errors. Deleting the second-to-last
  card does *not* navigate.
- `eslint` on the file reports the same single pre-existing
  `react-hooks/set-state-in-effect` (the completion effect) and nothing new;
  `tsc --noEmit` clean.
- Test rows created during verification were deleted afterwards by id.

## 2026-08-20 — Generate: make the empty-batch exit immediate + a loader

Follow-up on the item above, per direct feedback ("it takes a little time
before it goes back… I don't know why there's a delay though").

- `14:15` **Where the delay came from.** Three things in series, none of them
  visible: the card's 300ms exit animation had to finish before `posts`
  emptied, the `deletePost` round-trip had to come back (400–650ms in dev), and
  only *then* did the effect call `goBack()` — after which the router still had
  to fetch and render `/generate`. So ~1s of a completely static screen before
  anything moved. The first two were my own gate: I'd made the navigation wait
  on `deletesInFlight === 0` so a refused delete could put its card back.
- `14:18` Both waits removed. `handleDeletePost` now calls `goBack()` in the
  same click when `status === "completed" && availablePostCount === 1`, which is
  the app's ordinary optimistic-delete convention — the card is gone the moment
  you ask for it. A refused delete is the one case this can't undo; it reports
  through the toast the delete call already raises.
- `14:20` `hasDeletedRef` and `deletesInFlight` are both gone, replaced by a
  derived `isEmptiedByDeleting` (`status === "completed" && availablePostCount
  === 0 && generatedSoFar > failedCount`). `generatedSoFar - failedCount` is how
  many posts the batch actually produced, so a positive count over an empty grid
  can only mean they were all deleted — which is also what keeps a
  total-failure batch (same empty grid, zero produced) on its "Nothing to show"
  modal. Being derived, it can drive the render as well as the navigation
  without a second piece of state or a ref read during render.
- `14:22` The loader: an early return of `SectionSpinner` in the same
  `flex flex-1 items-center justify-center` box `loading.tsx` and
  `section-content.tsx` use, so the page hands over to the identical spinner in
  the identical place. Safe as an early return — every hook runs above it.

**Verified** in-browser on :3003, MutationObserver on `<main>` (ordering only —
absolute times are meaningless once an eval backgrounds the tab):
- delete → **spinner up with `cards: 0` while still on `/generating`** → path
  flips to `/generate`, spinner down. The spinner and the emptied grid land in
  the same commit, so there's no frame showing an empty results page.
- The screenshot taken immediately after the delete click already shows the
  Generate page; before this change the same screenshot still showed the card
  and needed a 3s wait.
- Deleting the second-to-last card still just fades that card out — no spinner,
  no navigation.
- Total failure (a uuid model id that resolves to no row, count 2) still lands
  on the "Nothing to show" modal, not the spinner.
- `tsc --noEmit` clean; eslint unchanged at the one pre-existing
  `set-state-in-effect`. Test posts deleted by id afterwards.

## 2026-08-21 — Generate: DialKit off the generating page

Per direct request, and the last item in this worktree's own stated purpose.

- Both panels are gone from `generating-view.tsx` — "Generating heading
  (elastic)" and "Generating card" — frozen at the values they were already
  sitting on, same treatment as `toast.tsx`, `use-shake.ts` and `day-deck.tsx`
  (git history has the panels if any of this needs re-tuning).
- The heading's five values became a `HEADING_ANIMATION` constant at the top of
  the file. They **have** to be passed rather than dropped: `AnimateText`'s own
  `ELASTIC_DEFAULTS` are a much bigger throw (offset 50 / duration 0.5 / bounce
  0.2) than this heading wants (5 / 0.3 / 0.4).
- The card's six values needed no constant at the call site at all — they were
  already `GeneratedPostCard`'s defaults, exactly. `GeneratingPostCard`'s were
  required props, so they became optional with the same six defaults declared
  as named constants in that file, and both call sites in `generating-view.tsx`
  now pass nothing. Net effect: the numbers live with the component that
  animates them instead of being threaded down from a panel that no longer
  exists.
- Comments reworded off "Live-tunable via the DialKit panel", which would
  otherwise have been describing a panel that isn't there.
- **DialKit itself stays installed** — `app/layout.tsx` still mounts `DialRoot`
  and `components/content/post-details.tsx` still has three live panels
  (Regenerating heading / body reveal / line entrance). That's the Content
  section, not this branch.

**Verified** on the running dev server: no panel renders on the generating
page, the heading still animates in and the cards still show the marching-dash
border and text pulse. One false alarm worth noting — a screenshot showed the
heading missing and an eval reported every character at `opacity: 0`; that's
the documented eval-backgrounds-the-tab trap (LEARNINGS → Browser automation),
not a regression. A `zoom` (which foregrounds) showed it rendered in full.

**Gates at handoff time:** `tsc --noEmit` clean, `npm run test` 56/56 in 7
files, `npm run build` clean. `npm run lint` **fails with 17 errors — all
pre-existing**, confirmed by counting them on a stashed tree: 17 on HEAD, 17
with these changes. They are `react-hooks/refs` and
`react-hooks/set-state-in-effect` across `switch.tsx`,
`create-project-modal.tsx`, `onboarding-context.tsx`, `project-sidebar.tsx`,
`projects-navbar.tsx`, `generate-calendar-column.tsx` and `generating-view.tsx`.
Not introduced here and mostly in hot shared files, so left alone rather than
widening this branch — see the note to the user at handoff.
