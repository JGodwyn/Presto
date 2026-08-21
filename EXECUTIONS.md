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

## 2026-08-20 — Content: newest post first within a day

**Task:** "The most recent post should stay on the top of the day. Currently
posts get added to the bottom, so the most recent might not even be visible on
a day with a lot of posts."

- Traced the order to `groupPostsByMonth` (lib/content-grouping.ts): day groups
  are built by pushing posts in the order `fetchPosts` returns them, which is
  `created_at` **ascending** — so a newly generated post landed at the bottom of
  its Kanban column (below the fold on a busy day) and at the far end of its
  day deck. Only the *months* and *days* were ever sorted; a day's own posts
  were not.
- Fixed in that one function: each `DayGroup.posts` is now sorted
  `byNewestFirst` (createdAt descending) after the day sort. Every consumer —
  `KanbanColumn`, `MonthBoard`'s tallest-column height, `DayDeck` via
  `openEntry.day.posts` — reads the same array, so one change covers all three.
- Sorted by **creation**, not by the scheduled time the day is keyed on: posts
  generated into the same day usually share a time (and drafts have none at
  all), which would leave the order arbitrary. Applied on every tab, Queued
  included — its *days* still read forwards ("what goes out next"), but the
  order inside one day answers "what did I just add".
- Test added to lib/content-grouping.test.ts covering Queued (day order forward,
  post order newest-first) and Draft. `vitest` 10/10, `tsc --noEmit` and
  `eslint` clean.
- Verified in-browser on :3002 (this worktree's dev server) against the real DB:
  the 27th August column holds three posts created Aug 20 / Aug 12 / Jul 31, and
  both the Kanban column (top→bottom) and the day deck (left→right) now render
  them in exactly that order — previously the reverse.

## 2026-08-20 — Content: expanding search in the header

**Task:** "add a search icon at the opposite end of the content header. replace
the info icon with it. when tapped, it should expand into a search bar with the
magnifying icon."

- No Figma export exists for this (checked all 50 in design-sync/), so it's
  built from what the page already uses: the collapsed chip borrows the "Show
  as" pill's surface/radius (bg-surface-3, rad-xmd squircle) at the info
  marker's 32px size, so the two right-edge controls read as one cluster.
- New `components/content/content-search.tsx`; header row in content-view.tsx
  became `flex justify-between` around the h1; the page passes
  `showInfoMarker={false}` to GlowPanel so the corner marker is gone on Content
  only (Generate keeps its own).
- Collapsed = the icon's own 32px well with no horizontal padding, so expanding
  moves *only* the box's right edge and the icon never shifts. Width animates
  (200ms, strong ease-in-out) — against the standards' transform/opacity-only
  rule, and deliberately: a scale would stretch the icon and the text.
- Focus is moved in a `useLayoutEffect` keyed on `open`, not in the click
  handler — focusing before the commit lands focus inside the still
  `aria-hidden` collapsed subtree, which Chrome blocks and logs. Verified: no
  console warnings across open/close cycles.
- Escape clears + collapses + returns focus to the icon button; blurring an
  empty field collapses; a field with text stays open on blur.
- Verified in-browser on :3002 — collapsed chip 32×32 with its right edge at
  1768px, exactly the "Show as" pill's (aligned to the same column padding);
  expanded 280×32 with the clip-path recomputed for the new width; focus,
  typing, Escape (value cleared, focus back on the button, input back to
  tabIndex -1 / aria-hidden) and blur-to-collapse all confirmed.
- **The query is intentionally not wired to filtering** — the ask was the
  affordance, and what search should match (content, topics, both; behaviour
  across tabs; empty-result state) is the next call to make.
- `tsc --noEmit` and `eslint` clean.

## 2026-08-20 — Content search: padding, clear, filtering, empty state

Five items off a list; four built, one argued against.

- **Horizontal padding.** The expanded field went from "icon flush at 4px, bare
  right edge" to `px-pad-sm`, which with each icon's own 4px inside its 32px
  button puts both glyphs exactly 12px in from their edge (verified in-browser:
  `searchGlyphLeftInset: 12`, `clearGlyphRightInset: 12`). Collapsed keeps zero
  padding — the chip *is* the icon button's box — so padding animates alongside
  the width.
- **Clear button**, `PaintBrushHousehold` per request (the icon Generate's reset
  already uses), mounted only when there's a value, with the `starting:`
  fade+scale used for conditionally-mounted adornments. It clears and refocuses
  the field rather than closing it. The existing blur rule already covers the
  ordering trap here: blur fires before the click, and it only collapses on an
  *empty* value, so the field can't vanish out from under the button.
- **Search itself** is `filterPostsByQuery` (lib/content-grouping.ts):
  case-insensitive substring over `post.content` only, per instruction — not
  topics (already chips on the card) or platform/date (each has its own tab and
  chip). Applied before the tab split, so it reads as "search within what I'm
  looking at", and the query deliberately survives a tab switch. No debounce:
  it's an in-memory filter over a few hundred posts inside a `useMemo`.
- The query moved up into `ContentView` (it filters the page, so the page owns
  it); the control keeps only open/closed. Changing it closes an open day deck
  for the same reason a tab switch does — the deck would be pointing at a day
  the page no longer lists.
- **Empty state** reuses `components/shared/empty-state.tsx`: MagnifyingGlass,
  caption "No matches", title `Nothing found for "…". Check what you typed and
  try again.`, no action. The echoed query is trimmed to 32 chars — the
  template's text blocks are a fixed 272px and a longer unbroken string would
  run straight out of the block.
- **Recent searches: not built, on purpose** — the item was asked as a question
  ("does this make sense?"). Argument in INTERFACE.md §9b: single-word queries
  over one's own posts are cheaper to retype than a dropdown is to build, keyboard
  navigate and persist. Easy to add later if search grows ranking or scope.
- Tests: four cases for `filterPostsByQuery` in lib/content-grouping.test.ts
  (case/whitespace, empty query, non-matching on topics/platform, no matches) —
  14/14 passing. `tsc --noEmit` and `eslint` clean.
- Verified in-browser on :3002: field geometry above; "culture" filters both
  Kanban and the day chips (27th August 3 posts → 1) and the counts follow; the
  query survives a Queued↔Published switch; a no-match query renders the empty
  state with the query echoed; the clear button empties the field, keeps it open
  and focused, and unmounts itself; Escape collapses back to 32px with padding
  gone and focus on the icon button. No console warnings.

## 2026-08-20 — Content search: padding pass, clear-icon blur, empty-state copy

- **Padding, both states.** `px-pad-xs` now applies open *and* closed, so with
  the 4px each icon has inside its own 32px button every glyph sits 8px in from
  its edge. Collapsed grew 32→40px wide (was the icon button's bare box, glyph
  wedged at 4px); expanded came down from 12px to 8px of glyph inset. Side
  effect worth having: padding no longer animates at all — only width — and the
  icon's offset from the leading edge is identical in both states. Measured:
  collapsed 40×32 with 8px either side, expanded 280 with the search glyph 8px
  in and its right edge still flush with the "Show as" pill's.
- **Clear icon** down to 20px (a size below the search glyph — it's the
  secondary of the two), and it now blurs in and out: opacity + scale 0.8 +
  blur(4px), 150ms on the app's strong ease-out. That needed `AnimatePresence`
  (motion/react, already a dep) rather than the `starting:` mount-in used for
  conditional adornments elsewhere — `@starting-style` has nothing to say about
  *leaving*, and React unmounts the element the moment it stops being rendered.
- **Empty-state copy** split per request: caption `No matches for **{query}**`
  (query bold), title "Check what you typed and try again". Echoing the query in
  the small line is the better fit for the template's own inversion — the
  caption names the state, the big line is the instruction.
  `components/shared/empty-state.tsx`'s `caption` widened from `string` to
  `ReactNode` for the bold fragment; the other two call sites are unaffected.
- Verified in-browser on :3002: geometry above; the empty state renders
  "No matches for **kubernetes**" over "CHECK WHAT YOU TYPED AND TRY AGAIN"; the
  clear button was caught mid-blur on its way out in a zoom capture and had
  unmounted by the following screenshot. Note the usual trap while checking the
  exit — `javascript_tool` backgrounds the tab, which suspends rAF, so Motion
  freezes and the element reads as "still mounted" indefinitely; only the
  screenshot path (which foregrounds) advances it. `tsc` and `eslint` clean.

## 2026-08-21 — Content search: echoed query stays subtle

- The bold query in the "no matches" caption was also carrying `text-text-bold`.
  Dropped, so it inherits the caption's `text-subtle` and only the weight sets
  it apart — verified in-browser: query and caption both `rgb(146, 138, 135)`,
  weights 700 vs 500.
- Automation note: `computer` left_click by *coordinate* stopped landing on this
  page mid-session — three clicks in a row left `document.activeElement` on
  `<body>` with no console errors and HMR connected, so the page was hydrated
  and fine. Clicking by `ref` (from `find`) worked first time. Worth reaching
  for the ref path rather than assuming the change under test is broken.
