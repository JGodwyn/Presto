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

## 2026-08-19 — Connections: connected state from the `connection-connected` export

- Read `design-sync/connection-connected/` (frame.json + screenshot) and diffed
  it against `connect-base`. The two frames are the **same three-part
  EmptyState layout** — 48px icon, caption, heading + action, gaps
  dist-lg/dist-lg/dist-xl — with only three things swapped: the icon
  (`Plugs` → `PlugsConnected`), the caption (grey line → green status pill),
  and the title copy. The previous pass had guessed there was no design for the
  connected header and stripped it; there is one.
- `components/shared/empty-state.tsx`: `caption` widened `string` →
  `React.ReactNode` so a screen can name its state with a badge instead of a
  line of text. No other change — the pill inherits the caption slot's centring
  and overrides its own type styles.
- `components/connections/connections-panel.tsx`: connected branch now renders
  the export's header rather than dropping it; new `ConnectionCountBadge`
  (surface-success-light stadium, body-md-bold/text-success, pluralized). It
  **skips the squircle clip** — rad-rd, same reasoning as toast.tsx (corner
  smoothing needs a straight edge to blend into).
- Row-list gap now follows each export: `dist-md` with plain rows, `dist-lg`
  once the taller connected block (green strip + its own expiry line) is in the
  list. Base was already dist-md and stays that way.
- **One value is not a token**: the dot is a 12px circle with a 3px *inside*
  stroke, and foundations.json stops at `stroke-lg` (2px). Used the export's
  literal weight as `border-[3px]` with a comment rather than snapping to 2px.

**Verified** in-browser on :3001 (this worktree's port), measured against the
export: badge 162×24 / #d5fed5 / #00a600 / 14px-700 / pad 2-8 / gap 4; dot 12px
with a 3px #6af26a ring over #00a600; badge→title 16, title→rows 24; rows 312
wide at gap 16. tsc and eslint clean.

## 2026-08-19 — LinkedIn connect flow (authorize → token → profile → disconnect)

Decisions taken with the user before building: no LinkedIn app exists yet (build
against env vars, they create it after); scopes are **sign-in only**; a
connection is **project-scoped**.

- **Schema** (this worktree holds the schema lock; additive, no drops):
  migration `create_social_accounts_table` — `public.social_accounts`, one row
  per (project, platform) via a `unique (project_id, platform)` that the
  callback's upsert targets, so reconnecting replaces a stale token instead of
  stacking rows. RLS is writing_styles' four per-command policies, project
  ownership checked in the insert policy. `encrypted_access_token` reuses
  key-crypto.ts's AES-256-GCM envelope and `MODEL_KEY_ENCRYPTION_KEY` — the
  function is named for API keys, the property it provides is what a token
  needs too.
- **lib/linkedin/oauth.ts** — endpoints, `openid profile email`, authorize-URL
  builder, token exchange, userinfo read, best-effort revoke. Every failure is
  one of nine short codes; nothing from LinkedIn's own error response is echoed
  into a URL. Redirect URI derives from the request origin (so localhost,
  previews and prod all work unconfigured) with `LINKEDIN_REDIRECT_URI` as the
  proxy override.
- **Route handlers, not server actions**, and that's the "real reason" AGENTS.md
  asks for: OAuth is a browser-redirect protocol, so the return leg has to be a
  GET endpoint at a fixed path. `authorize` checks session + project ownership
  (RLS makes someone else's project read as missing), sets an httpOnly
  `sameSite: lax` state cookie carrying the project id, redirects out.
  `callback` deletes the cookie first (one attempt per state), compares state,
  exchanges, reads the profile, upserts, and returns with `?connected=` or
  `?connect_error=`.
- **Disconnect is a server action** — reads the token, deletes the row, *then*
  revokes best-effort. A decrypt failure under a rotated key is swallowed: the
  row is already gone, which is what was asked for.
- **UI**: page is now an async server component (fetchSocialAccounts + the two
  search params); the panel holds accounts as client state for the optimistic
  delete, shows a spinner on Connect that ends when the browser leaves, and
  seeds its toast from the URL at mount before stripping the params with
  `window.history.replaceState`. Avatar prefers LinkedIn's `picture` claim
  (next.config.ts gained `media.licdn.com`), falling back to the gradient.
- `lib/linkedin/oauth.test.ts` pins the config resolution and, deliberately,
  that `w_member_social` never appears in an authorization request.

**Dead end worth recording:** the outcome toast read as "never rendering" over
several navigate → screenshot round trips, and an eval sent to check the DOM
showed it at `opacity: 0` — which looked like proof. Both were measurement
artifacts (the eval backgrounds the tab and freezes Motion; the 4s toast had
simply dismissed between calls). I had already written a comment blaming
`router.replace` for it; reverting to `router.replace` and re-measuring in a
single `browser_batch` showed it works identically. `replaceState` stayed —
it's genuinely lighter (no segment refetch to drop two query params) — but the
comment now says that instead of a fabricated bug. Logged in LEARNINGS.md.

**Verified** on :3001: connected row renders from a real DB row (name, "Expires
in 60 days"); Disconnect empties the row (`count → 0`) and returns the base
state; Connect with no credentials round-trips through the authorize route and
comes back with "LinkedIn isn't set up yet"; `?connected=linkedin` shows the
success toast and the URL strips itself. `npm run build` compiles both routes,
`vitest` 62/62, tsc and eslint clean. Untested end-to-end: the real LinkedIn
round trip, which needs the user's app credentials.

## 2026-08-20 — LinkedIn token facts checked against the official docs

Added the Microsoft Learn MCP at **user scope** (LinkedIn's developer docs are
hosted on learn.microsoft.com) and used it to verify the assumptions the
connect flow was built on rather than leaving them as inference.

**Confirmed, no change needed:** access tokens are issued with a 60-day
lifespan and `expires_in` is in seconds (5184000) — the expiry is derived from
the response anyway, so "Expires in 60 days" is real, not a guess. Programmatic
refresh tokens are limited to approved Marketing Developer Platform partners,
so a standard app genuinely has nothing to refresh with, which is what makes
the countdown load-bearing. `email`/`email_verified` are documented as
*optional* on the userinfo response — already handled. `sub` is pairwise
(per-app), as the type comment claimed.

**One real bug, found only because of the docs:** LinkedIn's own Sign In with
OpenID Connect page returns its sample `picture` from **media.licdn-ei.com**,
while the rest of its media documentation uses **media.licdn.com**.
next.config.ts listed only the latter, so a member whose photo happened to be
served from the other host would have hit next/image's host allowlist and got a
broken avatar. Both hosts are now listed. Verified against the running server:
an unlisted host is rejected by Next itself with a 400, both LinkedIn hosts get
through to the upstream fetch (403 on a deliberately fake path).

**A second, quieter hazard:** LinkedIn's profile-image URLs are dynamically
keyed and time-limited — its media guide says to re-fetch them periodically —
but this app stores one for as long as the connection lives, up to 60 days. So
the URL can die well before the row does. `ConnectedAccountRow` now falls back
to the gradient avatar `onError` rather than showing a broken image. Verified
by seeding a row with a dead licdn-ei URL: the gradient renders, no broken
image.

**Recorded for the publishing phase, not acted on:** adding `w_member_social`
later doesn't just re-prompt for consent — per the docs, requesting a different
scope than the one previously granted **invalidates all existing access
tokens**. Every connected account will need to reconnect on that day, and the
UI has to say so rather than silently 401. Written into lib/linkedin/oauth.ts
next to the scope list, where whoever adds it will read it.

**Open, flagged to the user, deliberately not built:** re-authorising *before*
expiry is a silent redirect (LinkedIn skips the consent screen if the member is
still signed in and the current token hasn't lapsed); after expiry it's the
full authorization screen. There's currently no Reconnect affordance and no
Figma export covering one, so it stays a decision rather than an invention.

**Gates:** tsc, eslint (at the HEAD baseline), vitest 62/62.

## 2026-08-20 — Connected-row expiry states from the four new exports

Read `connection-connectedstate{base,connected,expiringsoon,expired}`. Base and
Connected match what was already built (one change: the countdown's type moved
`body-md-bold` → `body-lg-bold` across the new set — applied). The other two are
the states the previous round had flagged as undesigned.

**Four things in the frames were ambiguous or stale; asked rather than
guessed**, and all four were confirmed: the Expired frame's green "1 connection
active" pill and its grey "Expires in 60 days" line are both leftovers from
duplicating the Connected frame (badge now counts live connections only and
drops to a subtle "No connections active"; the countdown is dropped once
expired); the loose outlined "Renew" button parked below the X row in the
ExpiringSoon frame is a canvas artifact, not a layout element; and losing
Disconnect in the expired state is intended.

- `expiryStatus` + `EXPIRY_WARNING_DAYS` (lib/format-date.ts) — shares
  formatExpiry's rounding, so the label and the colour can never disagree: a
  row reading "Expires in 7 days" is always the amber one.
- `ConnectedAccountRow` now takes `pending` / `onReconnect` and renders the
  three treatments. `RenewChip` is a local component, not a Button variant —
  rad-md at pad-sm/pad-2xs is a shape no Button size renders, and it should
  read quieter than the row's own action. It carries the export's tooltip,
  which is the state's whole justification: renewing early is a silent
  redirect, renewing late is a full re-authorisation.
- Renew and Reconnect both call the same authorize redirect as Connect, so the
  pending spinner and the callback's upsert are shared with no new plumbing.

**Verified** in-browser at :3001 by moving one row's `expires_at` across all
three thresholds: +5 days → amber countdown + Renew now chip, tooltip on hover
reading "Renew now to avoid having to authorize all over again"; −2 days → red
"Connection expired" strip, green Reconnect, no countdown, badge grey "No
connections active"; +60 days → green badge, `text-subtle` countdown measured at
16px/700 (body-lg-bold, the updated type). Test row deleted afterwards. tsc
clean, vitest 62/62, lint at the HEAD baseline.

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


## 2026-08-21 — LinkedIn flow verified against the real API

Credentials landed (they'd been pasted under LinkedIn's portal labels —
`Client ID=` / `Primary Client Secret=` — which aren't valid env var names, so
Next ignored both lines and the flow kept reporting "LinkedIn isn't set up
yet"; renamed by the user to `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`).
Checked first that nothing had leaked into the git-tracked
`.env.local.example` — it was still template-only.

**Connect, live:** the authorization request is accepted and its flow params
confirm what had only been asserted — `scope: openid+profile+email` with no
`w_member_social`, `redirectUri: http://localhost:3001/...` (so plain-http
localhost *is* accepted, no tunnel needed), `OAUTH2_AUTHORIZATION_CODE`, our
own `state` echoed back. The LinkedIn half was driven by the user: the
extension has no site permission for linkedin.com, and entering credentials
isn't something to automate.

**Row written:** name and email from userinfo, avatar on `media.licdn.com`,
token stored `v1.`-enveloped at 513 chars, scope recorded, `expires_at` exactly
60 days out, `sub` 10 chars. The **real profile photo renders in the connected
row** — the first live exercise of the `remotePatterns` fix.

**Renew, live — the best test available, and it passed:** pushed `expires_at`
to 3 days out, the row went amber with the "Renew now" chip, and clicking it
round-tripped through LinkedIn **with no interaction at all** — straight back
with `?connected=linkedin`. That confirms the docs' silent-renew claim
end-to-end. The upsert behaved exactly as designed: still one row, **same id**
(`f1b2a869…` — replaced in place, not delete+insert), `connected_at` bumped
10:52:29 → 10:58:41, `expires_at` back to 60 days, token re-encrypted. URL
params stripped afterwards (`location.search` empty), row back to green.

**New finding, recorded in code and LEARNINGS:** LinkedIn returns granted
scopes **comma**-delimited (`email,openid,profile`) though they're sent
space-delimited. Nothing reads that column today, but whatever checks for a
granted scope when publishing lands must split on both.

**Still unexercised: `disconnectSocialAccount`'s decrypt-and-revoke path.** It
is the only code that decrypts a stored token, and testing it necessarily ends
the connection, so it was left for the user to trigger rather than run
unilaterally. A scratch script that would have verified the decrypt directly
was written and then deleted — the sandbox correctly blocked it from reading
`.env.local`, and handling the user's credentials to prove a point was the
wrong trade.

**Nothing was published.** No share endpoint exists in this codebase and none
was called; the token carries sign-in scopes only.

## 2026-08-21 — Branch cleanup + parking the rest

Split the outstanding items into "belongs to this branch" and "belongs to
whoever picks up after the merge", on request.

**Fixed here:**
- `lib/format-date.test.ts` — `expiryStatus` was new threshold logic with no
  tests. Six cases: the 7-day boundary from both sides (7.4 days rounds to
  "7 days" and must be amber; 7.6 rounds to "8" and must not be), the
  final-hours floor (30 minutes left is *expiring*, never *expired*), and that
  the status can never disagree with the label rendered beside it.
- Accessible names on Reconnect and "Renew now". Both replace their label with
  a spinner while the redirect is in flight, which left them nameless mid-flight
  — the Connect button already carried an `aria-label` for exactly this.
- `searchParams` on the Connections page was typed `{ connected?: string }`,
  but Next hands a repeated param through as `string[]`. The type was a lie a
  crafted URL could expose; now typed as the union and narrowed by a `first()`
  helper.

**Audited, nothing to fix:** ran the Supabase advisors. `social_accounts` shows
an unindexed `user_id` FK and `auth_rls_initplan` on all four policies — and so
does every other user-facing table in the project. The table was written to
match the house pattern and inherited the house's flaws with it, so this is not
a regression from this branch; fixing it is cross-cutting work. The one security
advisor finding (leaked-password protection disabled) is an Auth dashboard
toggle, unrelated to any code.

**Parked in the new `FOLLOWUPS.md`** (union-merged like the other logs, and
announced in AGENTS.md's project-logs section so it's found): nothing consuming
a connected account yet (the Generate account pill — deliberately not touched,
since `generate-card.tsx` belongs to the live `feat/generate-page` worktree);
detecting a token revoked at LinkedIn's end; the decision about locking down the
encrypted-token column (recommendation: leave it — the fix needs either a
service-role client or a security-definer function, both worse than the
low-severity exposure they'd close); the cross-cutting advisor cleanup; the
publishing-phase prerequisites; and the two small unverified items.

## 2026-08-21 — Disconnect confirmation + success toast removed

Both on direct request. (The user also confirmed disconnect → reconnect works
against the real account, which closes the one item that was parked as
unverified — removed from FOLLOWUPS.md rather than left to rot.)

- **Confirmation modal on Disconnect.** No new component: `ConfirmationModal`
  (components/ui/confirmation-modal.tsx, the Figma "DefaultConfirmationModal")
  already existed for delete-post, so this is composition. Icon is `Plugs`, not
  `PlugsConnected` — it should show the state the button leads to, the way the
  delete modal's Trash does. The panel holds the pending *account* rather than a
  boolean, so the modal can name its platform and the confirm handler can't act
  on a row that changed underneath it; the title derives the label from
  PLATFORMS rather than hardcoding "LinkedIn" in a component that already
  renders two platforms. The delete stays optimistic — the confirmation moves
  the moment of *intent*, not the moment of feedback, so there's still no
  spinner.
- **Copy came from a copy-editor pass** (no `copy-editor` agent exists in this
  project — only `senior-engineer` — so a general-purpose agent was briefed as
  one). Shipped its recommendation: "Presto will lose access to this account
  until you reconnect it. Your posts and drafts aren't affected." It
  deliberately omits the token revocation (implementation detail), any mention
  of scheduled posts (untrue — publishing is unbuilt), and quantifying the undo
  ("about two seconds"), which would read as the modal apologising for itself.
  Its dissent is recorded in INTERFACE.md: it argued a reversible action doesn't
  earn a modal at all and that optimistic-delete-plus-undo-toast is the better
  instrument. Modal shipped as asked.
- **"LinkedIn connected" toast removed.** `outcomeToast` is failures-only now,
  and the toast's variant is fixed at danger. The URL params are still stripped
  on arrival — that logic never depended on there being something to show.

**Verified** in-browser: loading `?connected=linkedin` raises no toast and still
strips the param; Disconnect opens the modal (Plugs icon, "DISCONNECT LINKEDIN"
in Phudu caps, the copy above, full-width red "Disconnect", corner X); Escape
dismisses it with the row untouched. tsc and eslint clean on branch files.

**Note for anyone measuring a dialog through `javascript_tool`:** an eval
reports `[role=dialog]` still present after Escape, because backgrounding the
tab suspends the exit animation — the same trap already in LEARNINGS. Screenshot
to check; it foregrounds.

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

## 2026-08-21 — Content: filter menu from the Figma exports

Built from design-sync/content-filter-1 (nothing selected) and content-filter-2
(LinkedIn + two topics ticked) — two states of one popover.

- Read both frames with the figma-bridge skill. The menu is the app's existing
  `Menu` card down to the numbers: 216 wide, surface-4, border-subtle at
  stroke-lg, rad-lg, drop shadow 0/2/16 at 10%. Rows are the `_menu-item`
  shape `MenuItem` already implements (40px, gap-dist-md, body-lg), so both
  were reused rather than rebuilt — `MenuItem` only needed `px-pad-sm` and a
  full-width divider (`before:inset-x-0`) at the call site, since the export's
  list is already inset from the card edge.
- Measured the header chips off the export's SVGs rather than trusting the
  declared padding tokens: the frames are FIXED 44×32 with pad-md/pad-sm
  declared, but the glyph ink centres at 22,16 and spans 17px, which is a 24px
  icon centred in the box (10px either side — not a token, so the centring
  produces it). The search chip was resized to match (40→44) and its glyph
  moved from `icon-subtle` to `icon-bold`, which the export specifies (#181210).
- `lib/content-filter.ts` holds the shape and the predicate: platform ANDs with
  topics, topics OR among themselves, empty topics means all. Topics offered
  come from `topicsInPosts(posts)` — the whole project's posts, not the current
  tab/query, so the list can't reshuffle while you use it. 9 tests.
- Social is a cycling row (All → LinkedIn → X) rather than a dropdown, per the
  export's ArrowsClockwise — the same icon the "Show as" pill uses.
- The popover is portaled to `<body>`: GlowPanel's squircle is a clip-path, and
  clip-path clips every descendant including absolutely positioned ones (the
  trap already documented in topic-picker.tsx). Pinned right-aligned to the
  chip, 8px below, re-measured on scroll/resize.
- Three departures from the export, all in INTERFACE.md §9c: the chip's glyph
  goes `icon-brand` while a filter is on (the export only draws the rest
  state, and a silent filter reads as missing posts); a filter with no matches
  gets the no-matches EmptyState rather than the plain tab one the export
  draws; and the filter is deliberately *not* persisted, unlike the tab and
  layout.
- Verified in-browser on :3002 against the export's own numbers: menu 216×382
  (the export's exact height), right edge flush with the chip's at 1768, top
  8px under it, chips 44×32 with an 8px gap, rows 40px, list capped at 240px
  with 400px of content scrolling under the thumb. Behaviour: platform cycling
  (156 → 154 LinkedIn → 2 X on Queued), topic tick (79), untick returning to
  All topics, reset restoring everything and disabling itself, chip tint
  following active state, Escape/click-away/chip-toggle closing, and search
  composing with the filter (culture 16, +LinkedIn 16, +X 0 → empty state).
- Two automation notes, both cost time. (1) `npx prettier --write` on a file
  here reformats to semicolons — **this project has no prettier config and the
  codebase is semicolon-free**; don't run it. Rewrote the file by hand.
  (2) The Chrome extension's ref-click on the chip left it closed (it appears
  to deliver the gesture such that the toggle fires twice); a full synthesized
  pointerdown/mousedown/pointerup/mouseup/click sequence opens it correctly and
  a second one closes it, which is what the component is actually doing.

## 2026-08-21 — Content filter: padding, width, spin, fade

Four adjustments, all per direct feedback.

- **Padding** — every section in the menu went to `pad-lg` (16) both ways, from
  the export's `pad-md`/`pad-sm` (12/8). The ask was "+8", which lands on 20px;
  that isn't in the token scale (…md 12, lg 16, xl 24), so this takes the step
  that is, and the vertical outer padding does get exactly +8. Flagged to the
  user in case they want pad-xl instead.
- **Width** 216 → 240 (`w-60`, +24 as asked). `MENU_WIDTH_PX` moves with it —
  the portal's right-alignment maths needs the literal number, so the two are
  hand-synced like `EDGE_FADE_PX` elsewhere. Section content is now 208 wide,
  so "Artificial intelligence" fits without truncating (it didn't before).
- **Spin** — the Social row's ArrowsClockwise now turns half a rotation per
  tap. Rather than duplicating the "Show as" pill's implementation, that logic
  moved into `hooks/use-icon-spin.ts` (angle state + WAAPI animate + the
  resting inline `rotate`) and both call sites use it. The hook returns `ref`,
  so it must be destructured at the call site or `react-hooks/refs` fires.
- **Fade mask** on the topics list — `useScrollFade` (16 top / 32 bottom)
  composed with the existing `useScrollThumb` into one callback ref and one
  scroll handler, the same pairing content-view.tsx already uses for the page's
  month list.
- Verified in-browser on :3002: menu 240 wide, still right-aligned to the chip
  with an 8px gap; section padding computed as 16px 16px 8px / 8px 16px / 8px
  16px 16px; list 208 wide inset 16 either side, 400px of content in 240px;
  mask at rest is bottom-only 32px and becomes 16px top + 32px bottom once
  scrolled; the Social icon's inline rotate accumulates 360 → 540 → 720 with a
  running 300ms `cubic-bezier(0.23, 1, 0.32, 1)` animation attached, and the
  "Show as" pill still steps 0 → 180 after the extraction.
- Suite note: `lib/ai/generate.test.ts` is flaky *independently of this work* —
  it makes a real model call and intermittently hits vitest's 30s timeout
  (confirmed by running that file alone twice: pass, then timeout). Everything
  else is 69/69 green on every run.

## 2026-08-21 — Content filter: full-bleed topic dividers

- The topics section stopped padding its own sides; the rows carry `px-pad-xl`
  instead (16 + 8 = the same place the labels already sat, so nothing moved),
  which lets the list — and each row's divider — span the card's full 240px.
  Bleeding a divider *out* of a narrower list was never an option: the list is
  `overflow-y: auto`, which forces `overflow-x` to a scrolling value, so
  anything past its box is clipped.
- Two things fought back, both now commented at the call site. (1)
  `before:inset-x-0` did not win over MenuItem's `before:inset-x-pad-md` —
  tailwind-merge doesn't recognise `pad-md` as an inset value, so both classes
  ship and CSS order decides, and the shorthand is ordered last. Fixed with the
  `left`/`right` longhands, which Tailwind orders after the shorthand.
  (2) That got the divider to 232px, not 240: a pseudo-element is positioned
  against the *padding* box, and MenuItem carries a 4px transparent border for
  its highlight state. Negative `stroke-xl` offsets cancel it — the same
  cancellation MenuItem's own `-top-[…stroke-xl]` already does vertically.
- Verified in-browser: dividers computed at 240px wide starting at -4px, i.e.
  flush with both card edges; labels unchanged at 28px from the edge; ticking
  Design still filters (155 → 75) and unticking restores All topics.
- Automation note for this menu: a programmatic `chip.click()` doesn't show up
  in the DOM within the same `javascript_tool` eval — the eval backgrounds the
  tab, so React's commit lands later. Poll for the dialog inside the eval
  (100ms steps) rather than clicking in one call and measuring in the next,
  which just toggles it back shut.
- Follow-up: the topic rows' labels now line up with the "Topics" heading (and
  with "Social" and "Filter"). That meant *removing* the `px-pad-xl` added a
  step earlier and letting the rows keep MenuItem's own `px-pad-md` — 12px of
  padding plus its 4px transparent border puts the text at exactly 16, which is
  where the section headings sit. Verified with a Range over each text node
  (the section labels carry their padding on the span itself, so a
  getBoundingClientRect on the element measures the padded box, not the text):
  Filter / Social / Topics / All topics / every topic row all at 16, checkboxes
  16 from the right edge, dividers still 240px at -4px.
- The topics list's scroll thumb moved from 4px to 8px off the card's right
  edge — with the list running to the card's edges, 4px sat almost on the
  border. Verified: 8px gap, 4px thumb.
- Operational note, after the user asked why their dev server kept dying: one
  `pkill -f "next-server"` here is not scoped to this worktree — it kills the
  dev server in *every* worktree (main on 3000, connections-page on 3001,
  generate-page on 3003). Kill only the PID on this worktree's own port
  (`.worktree`'s PORT=3002), or better, leave it running between verifications
  rather than paying for a cold restart each time.

## 2026-08-21 — Content filter: persisted per project

- The filter now rides in lib/content-view.ts alongside the tab and the layout
  (`presto:content-filter:<projectId>`), by request — it must survive a tab
  switch *and* a refresh. ContentView reads it through the same
  `useSyncExternalStore`, so there's no local copy: writing is what re-renders.
- Two details the store needed. (1) **Snapshot identity**: that hook re-renders
  on any change of snapshot identity, so parsing JSON on every read would loop
  forever. `getContentFilter` caches the parsed object against the raw stored
  string per project, and `setContentFilter` invalidates that entry. (2)
  "Nothing selected" is stored as the *absence* of an entry and every unusable
  read returns the shared `NO_CONTENT_FILTER` instance, so the default is one
  object rather than a new equal one each time. `parseContentFilter` lives in
  lib/content-filter.ts so it can be tested without stubbing localStorage.
- **A restored filter is reconciled against the topics that still exist**
  (`reconcileContentFilter`, derived at render rather than written back). A
  topic filter saved before those posts were deleted or retagged would empty
  the page with nothing in the menu to explain it — the menu is built from the
  posts that remain, so the culprit row can't be shown. Derived, not repaired,
  so the selection returns if its posts do.
- Six new tests (parse round-trip, parse fallbacks by identity, unknown
  platform/non-string topics dropped, reconcile drop/no-op/collapse) — 15 in
  content-filter.test.ts, 76 across the suite.
- Verified in-browser on :3002: applying LinkedIn + Design writes
  `{"platform":"linkedin","topics":["Design"]}`; switching Queued → Published
  keeps it (67 posts, chip still brand-tinted); a full reload comes back on
  Published with the chip tinted and only LinkedIn/Design cards on the board.
- **Measurement trap worth remembering**: right after a reload in this
  automation environment the page reads as *un*restored — Queued, no filter —
  because the tab is backgrounded and React hasn't run the post-hydration store
  read yet. It isn't a bug (the tab and layout, which predate this work, look
  equally unrestored at that moment); waiting ~3s and screenshotting shows
  everything restored. Don't diagnose persistence from the first eval after a
  navigate.

## 2026-08-22 — ContentCurator agent (build-in-public content from the logs)
**Asked:** "i want to create a ContentCurator agent … it should read the project
and find places it can create content for social media from."

- `22:1x` Scoped it with two questions: source = this codebase (build-in-public),
  form = Claude Code subagent. Not an in-app feature.
- `22:2x` Measured the corpus before designing: `LEARNINGS.md` 21KB (already
  `symptom → cause → rule`, near 1:1 entry→post), `AGENTS.md` 130KB (36
  tension markers, densest), `EXECUTIONS.md` 64KB (19), 49 commits.
- `22:2x` Measured production rate to answer "when should it run": 24
  `EXECUTIONS.md` entries in 4 days. Supply outruns realistic posting cadence
  ~4–5×, so the trigger is demand-driven, not supply-driven — and the ledger
  caps `surfaced` at 8, refusing to run on unspent inventory.
- `22:2x` Dead end: proposed "main only, nothing in flight" as a precondition,
  on the assumption branch SHAs were unsafe to cite. **Wrong** — `/integrate`
  makes real merge commits (`25f91af` has two parents), so branch-authored
  commits sit in main's history verbatim and anchor permanently. Replaced with
  three ripeness tiers keyed on `/handoff`, not on branch.
- `22:2x` Dead end: tried computing time-spent from `EXECUTIONS.md`'s `HH:MM`
  stamps for the "log when I spend a lot of time on issues" ask. Too sparse —
  51 stamps across 24 entries, several with none, computable durations 6–50min
  (work sessions, not hard problems). Switched the metric to **recurrence**:
  skip-dates carousel 12 mentions / 6+ rounds, Content search 3 entries,
  Content filter 3.
- `22:2x` Found a real gap: an *unresolved* struggle is logged nowhere.
  `LEARNINGS.md` is "solved once, never again" so no resolution → no rule → no
  entry; `FOLLOWUPS.md` is deferred work, not stuck work. Added an **Open
  threads** table to the ledger to carry recurrence counts across runs.
- `22:2x` Ledger placed **outside the repo** (`~/Code/presto-content/`): the
  curator reads in-flight branches, so a checked-in ledger would exist once per
  worktree and dedup would silently break. Also keeps `git status` clean in
  every worktree and needs no `LINKED=()` symlink.
- `22:3x` Wrote `.claude/agents/content-curator.md` (`tools: Read, Grep, Glob,
  Bash, Write` — no `Edit`/`MultiEdit`) + `~/Code/presto-content/LEDGER.md`.
  Source-write protection is the existing `main-branch-guard.py`: the curator
  runs from the main checkout and reads branches via `git show <branch>:<path>`,
  never checking out.

**Verified:** frontmatter parses; `GUARDED_PREFIXES` in main-branch-guard.py
confirmed as the same six directories the agent is told never to touch. Cold-start
run not yet executed — held for the user.
**Logged:** EXECUTIONS.md only (no new rule or interface decision).

## 2026-08-22 — ContentCurator: durability without version control
**Asked:** "as far as it can be written to without being versioned and not
forget it's content or rewrite what's been written."

- `22:4x` Audited the failure modes of an unversioned dump dir. Two were live:
  the brief filename `YYYY-MM-DD-<slug>.md` claimed "two runs can never
  conflict" — untrue, same day + same slug and `Write` replaces the file whole;
  and the ledger was rewritten wholesale each run, which would silently discard
  the user's own hand edits (marking entries `mined` is their job).
- `22:4x` Added a "Never lose or overwrite what is already there" protocol to
  the agent: existence-check + numeric suffix before writing a brief; `cp` to
  `LEDGER.bak.md` before any ledger write; ledger rows append-only (add rows,
  change status cells, never delete/reword/reorder); post-write row-count
  verification against the backup, restore-and-report on a decrease.
- `22:4x` Made the ledger **reconstructible** rather than merely backed up —
  every brief must carry every fact its ledger rows assert, so the ledger is an
  index over append-only briefs. If it is lost, only "which entries were
  posted" is unrecoverable. No versioning needed for the content itself.
- `22:4x` Added a recovery header to `LEDGER.md` and took the first backup.

**Verified:** frontmatter parses; 35 ledger rows identical across
`LEDGER.md`/`LEDGER.bak.md`; the 13 surfaced entries intact after the header
insertion.
**Logged:** EXECUTIONS.md only.

## 2026-08-24 — Dashboard mockup (feat/dashboard, port 3003)

- `24:0x` No Figma export exists for a *populated* dashboard — `design-sync/
  dashboard` is only the "Nothing here" empty state (verified in the screenshot
  and the frame tree). Built from tokens + the existing component vocabulary
  instead, borrowing the Instructions page's rhythm: white `InstructionsCard`
  shells on the surface-3 canvas, **not** `GlowPanel` (which Generate and
  Content use, and which caps its own height to the viewport).
- `24:0x` Grounded in real data: "Design content" (421 posts — 156 draft,
  156 upcoming, 109 past) so the mockup is populated rather than invented.
- `24:1x` Built `lib/dashboard-summary.ts` — every figure derived from `posts`
  alone, date-derived exactly like `lib/content-grouping.ts` so the dashboard
  can't contradict the Content page. 11 tests in
  `lib/dashboard-summary.test.ts` (month split around `now`, remaining-coverage
  measured from today not the whole month, calendar-day relative dates). Green.
- `24:1x` Components under `components/dashboard/`: `DashboardCard` (+Header)
  shell, `StatTile` (NumberFlow), `MonthHeatmap`, `NextUpCard`/`RecentlyOutCard`,
  `TopicsCard`, `SetupCard`, `NoticeBanner`, `DashboardView` composing them.
  `page.tsx` keeps the existing `EmptyState` verbatim when a project has no
  posts and renders `DashboardView` otherwise.
- `24:1x` **Dead end:** `<Button asChild>` — this Button is `@base-ui/react/
  button` and has no `asChild`; Base UI composes via `render={<Link … />}`.
- `24:1x` **Bug, caught in-browser (blank error boundary, not a type error):**
  passed `hrefs.post: (postId) => string` from the Server Component into
  `DashboardView`. "Functions cannot be passed directly to Client Components."
  Replaced with a `postBase` string the client composes. See LEARNINGS.
- `24:1x` Two fixes after looking at it: the heatmap card is stretched by its
  taller Next-up neighbour and left a band of dead card under the footer
  (`justify-between`); dropped a decorative CalendarBlank from "Recently out"
  that carried no information.

**Verified** on port 3003 against the real "Design content" project (421 posts):
populated dashboard renders with correct figures (19 scheduled in August, 13 of
31 days covered, 7 of 8 remaining days empty, today ringed on the 24th), no
console errors, and a project with zero posts still gets the original
"Nothing here" empty state untouched.
**Logged:** EXECUTIONS.md, LEARNINGS.md, INTERFACE.md, AGENTS.md status.
- `24:2x` Fade mask on the Next-up / Recently-out preview lines, replacing the
  hard ellipsis — the app's standing treatment for content leaving its box.
  Used `useScrollFade({axis:"x", start:0, end:24})` rather than a static mask
  even though the line never scrolls: the hook sizes the fade to the distance
  actually hidden, so a short post gets no fade at all, which a fixed mask
  can't do (and the padding/negative-margin dodge the static masks use doesn't
  work on a line whose length varies per row).
- `24:2x` **Two false negatives while verifying it**, both artifacts of the
  automation rather than the code (now in LEARNINGS): mutating `textContent`
  in an eval doesn't re-render React so the mask read stale; and a real
  container resize still read stale because **ResizeObserver callbacks ride
  the frame lifecycle, which a backgrounded tab suspends** — the same trap as
  rAF. Interleaving a `computer` screenshot between the resize and the read
  gave the true value.

**Verified:** overflowing line → `linear-gradient(to right, black 0px, black
calc(100% - 24px), transparent)`; same element widened until the text fits →
`black 0px, black 100%`, i.e. no fade on resting content.
- `24:3x` **Misread the previous request.** The ask was the *page* scroll — content
  disappearing under `<main>`'s top edge with a hard cut — not the truncated
  text lines. Bottom deliberately left alone: `<main>`'s `-mb`/`pb` pair bleeds
  its scroll area past the page padding to the real screen edge, so content
  there runs off the display rather than clipping at a line.
- `24:3x` Reached for `useScrollFade` on `<main>` first. **It cannot be used
  there**, and the reason is worth keeping: five sections render their Toast
  into a `position: fixed` slot *inside* `<main>`, and a mask paints its whole
  subtree through the mask's geometry — a toast at viewport top-32px sits
  outside `<main>`'s box (top ~136px) and is erased outright. Verified with a
  red probe: applied the mask, screenshotted, probe gone.
- `24:3x` Along the way, checked (rather than assumed) which properties make an
  element the containing block for `position: fixed` descendants: of
  `mask` / `clip-path` / `filter`, **only `filter` does** — probe jumped from
  viewport 0,0 to main's 136,536. So the toasts keep their viewport position
  under a mask; being *painted out* is the whole problem.
- `24:3x` Built `components/shared/section-scroll-area.tsx` instead: a client
  `<main>` plus a sibling gradient strip in the canvas colour, opacity ramped
  from `scrollTop` over the first 24px and written straight to the element (no
  setState on a scroll frame). Layout now renders it in place of the bare
  `<main>`.
- `24:3x` **Bug, caught in-browser:** wrapping `<main>` sent the page content
  off the right edge. A flex child's automatic minimum size is its content, and
  `<main>` had only been getting away without `min-w-0` because
  `overflow-y-auto` zeroes that as a side effect — the new wrapper scrolls
  nothing, so it needs `min-w-0` explicitly. Same trap as GlowPanel's
  `min-h-0`, one axis over.

**Verified** on port 3003: fade absent at rest (header crisp), full strength
once scrolled, no bottom fade; a fixed probe inside `<main>` now paints *and*
the fade works, simultaneously; Instructions (page-scroll) and Content
(viewport-height + internal scroll) both unaffected by the shared-layout
change. 99 tests, typecheck and lint clean.

## 2026-08-25 — Dashboard, built from the Figma export (feat/dashboard, port 3003)

- `25:0x` Real exports landed: `design-sync/dashboarddesign` + `-2` (same page,
  second one scrolled). Read both screenshots and dumped frame.json to a
  token/size/style spec. Replaces the hand-composed mockup wholesale.
- `25:0x` **The export contradicts its own screenshot** on the calendar's first
  row — frame.json marks Aug 5 and 6 `surface-rest`/`text-minimal` (i.e. white
  with grey text, like an adjacent-month day) while the picture plainly shows
  them grey like every other empty in-month day. Cropped the screenshot to
  settle it; the picture wins, per the figma-bridge workflow.
- `25:0x` Reused rather than rebuilt: `Chip` (the topic chips are its
  unselected variant down to the 2px border-subtle), `DottedDivider` (the two
  `line-*.svg` dividers are border-bold dashes, same as the Instructions one),
  `SocialIcon`, `NumberFlow`. Phosphor covers all 11 exported icons
  (CalendarDots/CalendarCheck/CalendarDot/CalendarBlank/Scribble/Queue/Checks/
  Warning/QuestionMark/Eyes/CaretRight) — no asset copied.
- `25:0x` Card radius across this page is **rad-xmd (12)**, not the rad-lg the
  mockup used; only the post cards inside the Next-up column are rad-lg.
- `25:1x` Built the page: `total-posts-card.tsx` (stacked cumulative bar +
  legend + the black percentage marker), `stat-cards.tsx` (the bordered mini
  card and the plain one — they differ in label treatment *and* border because
  one sits on white inside the Total-posts card and the other on the canvas),
  `month-calendar-card.tsx`, `dashboard-post-card.tsx`, `next-up-column.tsx`,
  `posting-about-card.tsx`, `setup-card.tsx` (rewritten to the badge/pill
  rows), `dashboard-card.tsx` (retuned to rad-xmd), `dashboard-view.tsx`.
  Removed the superseded mockup pieces: month-heatmap, next-up-card,
  notice-banner, stat-tile, topics-card.
- `25:1x` **The notices strip is gone**, because the export has none. The two
  signals it carried didn't get dropped: an expiring/expired connection and a
  BYOK key that fell back now downgrade their own Setup row to the warning
  tone ("Expiring" / "Key failed"), which is already the page's one place that
  reports on each.
- `25:1x` **TryOn is a placeholder**, per instruction. It renders as the third
  platform row at 0 posts/0%, with the export's Eyes glyph and Purple50/600
  bar. `types/post.ts`'s `PostPlatform` is untouched — it's `linkedin | x`, it
  is a shared *and* hot file, and the branch adding try-on owns that change.
  When it lands, this row reads its real count the way the other two do.
- `25:1x` The Next-up column is a **scroller** — the export clips it
  mid-"Recently out" at the calendar card's height. Bounded with the
  relative/`absolute inset-0` pair the Content page uses, since every ancestor
  here is content-sized. `useScrollFade` is safe on it (no fixed descendants,
  unlike `<main>`).
- `25:1x` The marker's "60%" has no stated source in the export. Implemented as
  the share of the library that's actually on the calendar (total − drafts),
  drawn at the percentage it reports, so position and label can't disagree.
  Noted as an interpretation at the call site.

**Verified** on port 3003 against the live project: all four rows render to the
export — Total-posts card with bar/legend/marker, the three mini cards, the
three stat cards, the month grid (today ringed in border-brand, content days
purple, adjacent days minimal), the scrolling Next-up/Recently-out column,
topic chips, the three platform bars including the TryOn placeholder, and the
six Setup rows with their badge/pill tones. Zero-post projects still get the
untouched "Nothing here" empty state. 102 tests, typecheck and lint clean.
- `25:2x` Three Agentation annotations on the Total-posts card, all applied:
  (1) left block `w-60` → `w-66` (240 → 264px, reading "24 units" as 24px);
  (2) legend row `justify-center` → `justify-start`;
  (3) "rounded corner edges for every bar" — which turned out to be a **real
  bug, not a preference**: `rounded-rad-rd` computes to 0px because `--rad-rd`
  is a `:root` variable that was never mapped into `@theme` as
  `--radius-rad-rd`. All five uses were mine; swapped to `rounded-full` (the
  codebase's existing stadium class — toast.tsx made the same swap). This also
  silently fixed the platform bars and the Setup badges, which were squares.
  See LEARNINGS.
- `25:2x` Agentation's MCP server drops the connection on every
  `get_all_pending` call (reproduced twice after a clean reconnect), so the
  annotations were read straight from its SQLite store at `~/.agentation/
  store.db` (copied first, queried read-only) against the session id in the
  page's own localStorage. `list_sessions` works; `get_all_pending` is what
  kills it.
- `25:3x` Second annotation round (4, read via MCP `get_session` this time —
  see below), all applied and resolved in Agentation:
  (1) the Total-posts percentage is now a **hover tooltip through
  `components/ui/tooltip.tsx`** instead of a permanent black bubble — that
  component's first real call site. The bar is the trigger (a zero-width
  marker at the percentage is not hoverable, and Base UI centres the bubble on
  its anchor regardless); `TooltipProvider delay={200}` since `Tooltip.Root`
  takes no `delay` prop in this Base UI version; `tabIndex` + an aria-label
  carrying the full split, so a hover-only readout doesn't lose the figure for
  keyboard and screen-reader users.
  (2) Total-posts block `w-66` → `w-72` (288px). (3) Calendar card `xl:w-84` →
  `xl:w-90` (360px). (4) TryOn's Eyes glyph `fill` → `bold`.
- `25:3x` **Root cause of the Agentation crashes found**: `get_all_pending`
  aggregates across every session, and one old session
  (`ms398qeb-amjxvk`, a /generating run) holds **4,880** pending annotations —
  enough to kill the server every time. `get_session` on a single id works
  fine and is what to use here.

**Verified** on :3002: tooltip absent at rest and present on hover with its
pointer; block widths measured 288 and 360; Eyes renders outlined. 102 tests,
typecheck and lint clean.
- `25:4x` Total-posts bar reworked per direct feedback — three changes:
  - **Per-segment tooltips.** Paint and hit-testing are now deliberately
    different geometries. Paint stays *cumulative* (track = Published at full
    width, Queued over it, Draft over that) because that overlap is what makes
    the three read as one continuous stadium rather than three pills with
    seams — it's how the export draws it. Hit-testing can't use that: the
    painted Queued div spans draft+queued, so hovering it would report the
    wrong share. Three transparent bands are laid over the top instead, each
    owning only its own slice, each its own tooltip anchor — which also lands
    the bubble centred on the slice being hovered rather than on the bar.
  - **Hover expand**, 8px → 10px on a 150ms ease-out. Uses `height`, not the
    `scaleY` transform STANDARDS.md would normally prefer: scaling a stadium
    distorts the very radius that gives it its shape. Sits inside a fixed
    `h-4` rail so growing can't nudge the legend below it.
  - **`delay={0}`** — the percentages are the point of the bar, not a hint
    about it, so a delay just makes it feel unresponsive.
  - A state with no posts gets a zero-width band and is simply unhoverable,
    which is right: there's nothing to report.

**Verified** on :3002 by hovering each band in turn — Draft 55%, Queued 27%,
Published 18% (sums to 100), each bubble centred over its own slice; and an
A/B crop at identical region showing the bar thicker while hovered with the
legend unmoved. 102 tests, typecheck and lint clean.
- `25:5x` Tooltip content is now "Draft (55%)" — state name plus its share.
- `25:5x` **Root-caused the intermittent Generate failure** the user reported
  ("We couldn't load this page…"). Not a network problem and not intermittent:
  `components/generate/generate-card.tsx` restored `account` from localStorage
  **unvalidated**, then line ~358 non-null-asserted the lookup
  (`ACCOUNT_OPTIONS.find(...)!`) and read `selectedAccount.icon` → `TypeError:
  Cannot read properties of undefined (reading 'icon')`, caught by
  `[projectId]/error.tsx`, which renders exactly that copy. Confirmed from the
  browser console and by reading the stored value.
- `25:5x` **Why it looked random: localStorage is keyed by _origin_, not by
  branch or worktree.** Both projects had `account: "tryout"` saved under
  `http://localhost:3002` — written by the try-on branch's dev server when it
  held that port. This branch's server moved 3003 → 3002 and inherited it. On
  3003 the key didn't exist and the page loaded fine; same code, same branch,
  different port.
- `25:5x` Fixed the same way `model` already was two lines above (that one had
  the guard and the explanatory comment; `account` was simply missed):
  validate on restore, and `?? ACCOUNT_OPTIONS[0]` instead of the `!`. Purely
  defensive — when the try-on branch lands and adds "tryout" to the options,
  the stored value validates and nothing here fights it.

**Verified** on :3002: both projects' Generate pages load, including the one
whose stored value is still "tryout" (the fallback path); the visited project's
key self-repaired to "linkedin"; tooltips read "Draft (55%)" / "Queued (27%)".
102 tests, typecheck and lint clean.
- `25:6x` Setup section rebuilt from the `dashboardsetup` export: a **3x2 grid
  of tiles** on the surface-3 tray, replacing the full-width rows. Same six
  fields, same three tones (badge, pill and caret all tinted together), same
  hrefs — only the shape changed.
  - Tray is now `rad-xmd` + `pad-sm` with **no border** (the row version had a
    `stroke-lg border-minimal`); tiles are `rad-xmd`, `stroke-md
    border-subtle`, `px-pad-md py-pad-sm`, column `gap-dist-md`.
  - `mt-auto` on the pill pins them to a common baseline across a row: grid
    stretches every tile to the tallest in its row, so a label that wrapped to
    two lines would otherwise push its own pill out of line with its
    neighbours'.
  - The export's header is just the title, so the "n of 6" counter the row
    version carried is gone with it. Copy follows the export: "AI Model".
  - Badges use `rounded-full`, not `rounded-rad-rd` — see LEARNINGS.

**Verified** on :3002 against the export: 3x2 grid, tone badges and pills,
tinted carets. Tiles render wider than the export's fixed 144px because this
card is `flex-1` in a fluid row rather than a fixed 496px frame. 102 tests,
typecheck and lint clean.
- `25:7x` Re-exported `dashboardsetup` (stripped down) — three things removed,
  nothing added: the outer white `DashboardCard`, the surface-3 tray, and the
  tiles' `border-subtle` stroke. The section is now the title over a bare 3x2
  grid of white tiles directly on the page canvas (root frame is surface-3
  with `pad-null`), and tiles went 144x108 → 160x108. Badges, labels, pills,
  tones and hrefs all unchanged.
  - Consequence worth knowing: Setup is now the only block on the dashboard
    that isn't a `DashboardCard`, so it sits next to "What you're posting
    about" (still a white card) with no card chrome of its own. That's what
    the export shows.

**Verified** on :3002 against the new screenshot: six borderless tiles, no
tray, title on the canvas. 102 tests, typecheck and lint clean.
- `25:8x` Two more 24px width steps: "What you're posting about" `xl:w-102` →
  `xl:w-108` (408 → 432px), and the Total-posts left block `w-72` → `w-78`
  (288 → 312px). Both measured in-browser.
- `25:9x` **Reverted the generate-card.tsx patch.** `main` has moved 2 commits
  ahead and one of them ("Generate: the account pill shows real connected
  accounts", FOLLOWUPS #1) rewrote that account handling: it already has the
  `?? accountOptions[0]` fallback instead of the non-null assertion, a repair
  effect gated on `socialAccountsLoaded`, and a real "Try out" option — so the
  stored `"tryout"` value now *matches* rather than crashing. My fix was
  redundant and would only have conflicted in a file this branch doesn't own.
  The reported bug is fixed by merging main, not by this branch.
- `25:10x` **Days with content are clickable on the dashboard calendar.** Only
  days that actually have posts become links; empty days stay inert spans
  (verified in the DOM: 8 links, the rest spans). Clickability is keyed on the
  *count*, not the rendered state — a day that is both today and has posts
  renders as "today" (the ring wins) and must still be clickable.
- `25:11x` **Corrected the above after direct feedback.** "Content has no route
  for a day" was the wrong conclusion to draw from "no route opens a deck" —
  the Next-up cards on this same page already link to `/calendar/<postId>`, a
  real per-post route. So a day holding **exactly one post now links straight
  to that post**, the same destination Next-up uses; only a day with several
  falls back to Content with its tab selected, since there's nothing to
  disambiguate between. Verified in the DOM (1-post days → post page, 2- and
  3-post days → Content) and end to end: clicking Aug 27 opens the post's own
  page, headed "August 27th, 2026".
- `25:10x` **Where it goes, and why not further.** Content has no route for a
  single day — its deck opens from a chip on the page — so deep-linking would
  mean teaching `components/content/content-view.tsx` to open a deck from a
  URL. That file is dirty in the live `post-accounts` worktree (along with
  `day-deck.tsx`), so editing it from here is a guaranteed conflict in a file
  this branch doesn't own. Instead the day links to Content with the right
  *tab* already selected, via `setContentTab` — `lib/content-view.ts` is a
  public store, is not dirty anywhere else, and the page reads it through
  `useSyncExternalStore` on arrival.
- `25:10x` The tab is chosen from `upcomingByDay` (new on `MonthSummary`), not
  from the date: a day with anything still to come is Queued, otherwise its
  posts have all gone and it's Published. By date alone *today* would always
  read as Queued even when everything on it already went out. Pinned by a test.
- `25:10x` The React Compiler rejected the original `for` loop building the
  cells (`react-hooks/immutability`): each cell's click handler closes over its
  day, and the loop then reassigns that variable. Rebuilt with `Array.from`.

**Verified** on :3002 end to end: clicking Aug 18 (past) lands on Content with
**Published** selected and 18th August on the board; clicking Aug 27 (future)
lands on **Queued** with 27th August there. Typecheck and lint clean; 102 of
103 tests pass — the one failure is `lib/ai/generate.test.ts`, which calls the
real Gemini API and is hitting the free-tier quota (20 requests/day, exhausted
by this session's own generating). Untouched by this branch and not a
regression; it passes again once the quota resets.

## 2026-08-25 23:22 — dashboard: "TryOn" renamed to "Try out"

Per direct instruction, one spelling wins and it is **"Try out"** — matching
`TRY_OUT_ACCOUNT_ID`, `isTryout` and the `is_tryout` column that
`feat/post-accounts` put on `main`. This branch had coined "TryOn" for its
placeholder platform row while that branch was still in flight, so the two
names met for the first time at integration.

Renamed: `posting-about-card.tsx`'s `PLATFORM_BARS.tryon` key, its
`platform === "tryon"` glyph branch and the row's `label`. Living reference
docs followed (INTERFACE.md's platform-bar note, AGENTS.md's status line).
Earlier entries in this log keep the old name — they are a record of what was
done at the time, not a spec.

Also corrected FOLLOWUPS entry 2, whose stated plan had become wrong.
It assumed `PostPlatform` would gain a try-out member, which would have made
`platformSplit()` pick the row up for free. That is not what landed: a try-out
post carries `platform: "linkedin"` with a separate `isTryout` flag, so those
posts are *already counted under LinkedIn*. Wiring the row means partitioning
on `isTryout` first — which changes a figure the dashboard already reports, so
it stays a follow-up rather than riding along with a rename.

No behaviour change in this commit: the row still renders at zero.
## 2026-08-24 — Generate: real connected accounts in the account pill
**Asked:** "show real connected accounts on the menu. unavailable accounts
should be grayed out. i also want to add a test account… I called it 'Try out'."
Export: design-sync/generate-page-modal. Worktree `generate-page`, **dev server
on :3002** (the running one for this dir — `.worktree` says 3004, nothing was
listening there and this one was already up, so it was left alone).

- Read the export: a 200px Menu under the account pill with three rows — "Try
  out" (Phosphor `Eyes`, icon-minimal), "LinkedIn" (brand mark), "Twitter"
  greyed to `text-minimal` with its mark at **opacity 0.1**. Icons sit in a
  trailing 24px "R.Slots" box at 20px; the trigger's own mark stays 16px and
  leading.
- Decided the two things the brief left open, before writing anything:
  **"Try out" is the default** (generation needs no account, and nothing
  connected is the common case — the pill must not rest on a greyed row), and
  **an account's value is its platform**, since `social_accounts` is unique on
  (project_id, platform). That keeps the localStorage value and the
  `/generating?account=` param exactly the shape they already had. Kept the
  user's own name for it; "Try out" pairs with the Eyes icon and matches the
  export. Recorded in INTERFACE §9d.
- `components/generate/account-options.tsx` (new): `TRY_OUT_ACCOUNT_ID`,
  `buildAccountOptions(connectedPlatforms)`, each option carrying both its
  20px menu icon and its 16px trigger icon. Labels are platform names per the
  export, with "Twitter" corrected to "X (Twitter)" to match Connections.
- `select-pill.tsx`: `SelectPillOption.disabled`, the export's label-fills /
  icon-trails row, and keyboard nav that skips disabled rows
  (`nextEnabledIndex`, wrapping, and returning `from` when only one row is
  selectable so it can't spin). `pick` refuses a disabled option, and
  `openMenu` starts the keyboard on a selectable row rather than on a stale
  disabled selection.
- `generate-card.tsx`: fetches with the existing `fetchSocialAccounts` (read
  only — queries.ts is another branch's hot file and was not touched), behind
  a `socialAccountsLoaded` flag mirroring `userModelsLoaded`. **Killed the
  latent crash at the old line 358**: `ACCOUNT_OPTIONS.find(...)!` on an
  unvalidated localStorage value now falls back to the Try-out option, with a
  separate effect repairing the persisted value once the fetch has actually
  resolved — the same shape as the model fix, and now genuinely reachable
  since an account can be disconnected.
- Dead end worth keeping: clicking a greyed row closed the whole menu. Not the
  click handler — a disabled `<button>` dispatches no mouse events, so the
  menu's focus-holding `onMouseDown` never ran and the trigger blurred. Fixed
  with `pointer-events-none` on the disabled row (LEARNINGS).
- Updated `social-platform-options.tsx`'s header comment, which still claimed
  the account pill shared that list, and the `/generating` page's comment, so
  "Try out" borrowing LinkedIn is a stated decision rather than a fallback
  nobody meant.

**Verified** in-browser on :3002. Project *Design Content* (LinkedIn connected
as Godwin John): menu renders Try out / LinkedIn / greyed X (Twitter); a click
on the greyed row selects nothing and leaves the menu open; ArrowDown steps Try
out → LinkedIn → wraps past the disabled X back to Try out. Project
*Megalomania* (nothing connected): both platforms greyed, and a persisted
`account: "linkedin"` seeded into localStorage was repaired to `"tryout"` on
load. DOM check on the greyed rows: `disabled`, `pointer-events: none`, colour
`rgb(202,194,191)` (= text-minimal), icon opacity `0.1` — the export's values
exactly. End to end: generated one post on TasteTest with Try out selected,
URL `?count=1&account=tryout&model=tastetest`, card came back on LinkedIn as
intended; test post deleted afterwards. `tsc --noEmit` and ESLint clean.
**Logged:** EXECUTIONS.md, INTERFACE.md §9d, LEARNINGS.md.

## 2026-08-24 — Generate: four polish items (same branch, :3002)
**Asked:** cut the "How many posts…" → stepper gap by 8pt; tooltips on the
model and social pills ("Model to use" / "Socials to generate for"), showing
faster than usual; bold the Try-out eyes icon; drop the top-right info icon.

- **Gap.** The column is `gap-dist-xl` (24px) and that gap also sets
  box→pills→button→footer, so the heading and the stepper are now their own
  nested `gap-dist-lg` (16px) group — a real token rather than a
  `-mt-dist-md` cancelling margin. Measured live: heading→box 16px,
  box→pills still 24px.
- **Tooltips.** `SelectPill` gained an optional `tooltip` node and wraps its
  own button as the `TooltipTrigger`, so the bubble anchors the capsule and
  picks up focus as well as hover — rather than wrapping `<SelectPill>` in a
  span, which would have anchored a box that isn't the control. `delay` is a
  **Provider** prop in this Base UI version (not on `Tooltip.Root`), so one
  `TooltipProvider delay={300}` wraps both pills in generate-card; that also
  groups them, so the second pill's tooltip shows instantly after the first.
  App default elsewhere is 600ms and is untouched.
  - The tooltip is `disabled` while the menu is open. Both hang off the same
    button, and left alone the bubble sat over the options.
- **Eyes** → `weight="bold"` on both the 20px menu icon and the 16px trigger
  icon in account-options.tsx.
- **Info marker** off via `GlowPanel`'s existing `showInfoMarker={false}`.
  Noticed on the way past that this was the last page rendering it — Content
  and the post-details screens already pass false — so the prop's `true`
  default is now unreachable. Left the shared component alone and wrote it up
  in FOLLOWUPS rather than editing it here.

**Verified** in-browser: gap measured at exactly 16/24; both tooltips open on
hover, fully opaque, correctly positioned above their pill ("Socials to
generate for" captured in a screenshot) and absent while the menu is open;
the eyes icon reads bold in both the pill and the menu row; the Generate
corner now holds only the reset button, and Content's corner is unchanged.
Harness note: a `zoom` immediately after a `hover` can close a tooltip that
had just opened, and since the pointer never leaves and re-enters it never
reopens — the tooltip looked broken until it was read out of the DOM. Take
the screenshot on a fresh hover.
`tsc --noEmit` clean; ESLint clean on every touched file (the 10 errors under
components/generate remain the pre-existing ones in generate-calendar-column
and generating-view, both untouched).
**Logged:** EXECUTIONS.md, INTERFACE.md §9d, FOLLOWUPS.md.

**Closed out:** FOLLOWUPS entry 1 ("Nothing consumes a connected social account
yet", parked by `feat/connections-page` on 2026-08-21) is exactly this branch's
job and is now done — deleted from FOLLOWUPS per the file's own rule. Its three
asks all landed: the pill reads `fetchSocialAccounts` with the browser client,
the no-connection and expired-connection cases are decided and written up in
INTERFACE §9d, and the persisted-value non-null-assert is gone. The remaining
numbered entries were left as they are rather than renumbered — they belong to
another branch's section.

## 2026-08-24 — feat/post-accounts: clean slate, retired topic chips, real accounts on post cards

- Answered the opening question first: `posts.topics` is a denormalized `text[]`
  snapshot (NOT NULL DEFAULT '{}'), **not** a FK to `instructions.topics` — so
  deleting a topic breaks no reference, and a post with no topic is already
  routine (`topics: topic ? [topic] : []`, post-actions.ts). Confirmed against
  the live DB.
- Claimed the (free) schema slot in `.worktree` — this round needs one additive
  migration. Worktree port is **3002**.
- **Wiped all posts** at the user's explicit request ("clean slate, cos of #3"):
  430 rows, all in the "Design content" project, every other project already
  empty. `delete from public.posts` — verified 0 remaining.
- Migration `add_posts_is_tryout_column`: `is_tryout boolean not null default
  false`. Needed because `generating/page.tsx` collapses the "Try out" account
  to platform `linkedin`, which made a try-out post indistinguishable from a
  real one — and once the card shows the *account* rather than the platform,
  that mislabels a stand-in post with the user's actual LinkedIn name.
- Centralized the posts table's shape before adding to it: the column list was
  duplicated across six `.select()`s and the row→Post mapping across four call
  sites, which is how a new column goes stale one call site at a time.
  `POST_COLUMNS`, `PostRow` and `mapPostRow` now live in lib/supabase/queries.ts;
  post-actions.ts re-exports `PostRow` since app/api/regenerate-post/route.ts
  imports it from there.
- `lib/post-account.ts` — the resolver behind "show the real account". No
  `social_account_id` on posts and none needed: social_accounts is unique on
  (project_id, platform), so a platform already identifies exactly one account
  within a project. `resolvePostAccount` prefers the account's own name, falls
  back to the platform label when that platform isn't connected, and reports
  "Try out" for a stand-in post. `nextPostAccount` is the cycle.
- Threaded `accounts` + `activeTopics` from calendar/page.tsx (a `Promise.all`
  of posts/accounts/instructions) through ContentView → MonthBoard →
  KanbanColumn → KanbanPostCard, and → DayDeck → GeneratedPostCard.
  GeneratingView fetches accounts browser-side, the same read GenerateCard
  already makes (it's a client component and can't fetch server-side).
- Chip gained a third palette, `retired` — surface-4 / border-minimal /
  text-minimal, per direct spec. It overrides `selected`, and the
  selected+onRemove branch is now explicitly guarded against it: a retired
  topic isn't in the selectable set at all, so it can't be the removable
  variant.
- **A test caught a real bug in my own guard.** `nextPostAccount` first read
  `if (platforms.length < 2) return null`, which is wrong for a post whose
  platform has since been disconnected: it *does* have somewhere to go (the one
  connected account) even though only one platform is connected. The length
  check now runs *after* the "its own platform isn't in the list" branch. Pinned
  by lib/post-account.test.ts (11 tests).
- Lint: only one new error, `calendar/page.tsx`'s `now={Date.now()}` — my edit
  moved the JSX so the existing `eslint-disable-next-line react-hooks/purity`
  no longer landed on the offending line. Hoisted `Date.now()` to a const with
  the comment on it. Diffed against a stashed HEAD baseline to prove the other
  17 errors are all pre-existing.
- Verified in-browser on **:3001** (this worktree's server was already up there,
  not the 3002 its `.worktree` records) against four temporary posts covering
  every branch, deleted afterwards: connected LinkedIn → "Godwin John"; a
  deleted topic → retired chip measured at exactly `#fffffe`/`#f3efec`/`#cac2bf`
  vs the live chip's surface-3/border-subtle/text-subtle, squircle clip intact;
  a try-out post → Eyes + "Try out", never the real name; an X post with no X
  connection → falls back to "X". The pill renders as a `<span>` with
  `cursor: auto` and `tabIndex -1` (one connected account = nothing to cycle to),
  not a dead button.
- Left alone: one draft created at 14:12:55Z, *after* the wipe and not one of
  the verification rows — new work, not mine to delete.
- **Bug I shipped, and the fix.** Generation 500'd with `ReferenceError:
  PostRow is not defined` at module evaluation of post-actions.ts. Cause: when
  I moved the type into queries.ts I left `export type { PostRow }` behind in
  post-actions.ts so the regenerate route wouldn't have to change its import —
  but that file is `"use server"`, and Next's server-actions loader enumerates
  its exports and registers each as a callable action *after* types are erased,
  emitting a value re-export of a binding that doesn't exist at runtime. `tsc`
  can't see it (the TypeScript is valid; the breakage is in the emitted
  module). Fixed by deleting the re-export and having
  app/api/regenerate-post/route.ts import `PostRow` from lib/supabase/queries
  directly, which is where it's declared anyway. Every export from
  post-actions.ts is now an async function. Written up in LEARNINGS.md.
- Re-verified by actually running a generation (`count=2&model=tastetest`) in
  the browser rather than trusting the gates that missed it: two posts written,
  both cards showing "[in] Godwin John". Deleted the two I created. The one
  console error left is an `InvalidStateError: Transition was aborted` from
  navigating straight to /generating — that page's `enter="blur-in"` expects
  the handoff from /generate, so there's no outgoing transition to pair with.
  Pre-existing and unrelated.

## 2026-08-25 — post-accounts: DialKit out, Try out in the cycle, post-details from contentpagenew

- **DialKit removed from the Content section.** post-details.tsx held the last
  three panels ("Regenerating heading (elastic)" / "body reveal" / "line
  entrance"); values frozen as `REGENERATING_HEADING`,
  `REGENERATING_LINE_DELAY_MS` and `REGENERATING_LINE_ENTRANCE` at module
  scope, same treatment as toast.tsx, use-shake.ts and day-deck.tsx. The
  reveal effect's dependency array collapses to `[isRegenerating]` — the
  entries it listed were dial readings, and module constants can't change
  between renders.
- **Move-to-draft toast now fires on the click, not on the response.** It was
  inside the `.then()`, so it trailed a move that had already happened
  optimistically. Measured the fix with a MutationObserver: toast node added at
  **t=15ms**, the server request completing at **t=1198ms** — i.e. ~1.2s
  earlier. The failure branch still reverts the patch *and* replaces the toast
  (error toast, or closes it outright when the request never landed), so a
  toast offering Undo can never outlive the move it offers to undo.
- **"Try out" is now a cycle position** (direct request: "it should cycle
  between the available ones (even tryout)"). This reverses the earlier call
  that a try-out post's pill is static — and the earlier call was wrong in
  practice: with one connected account, excluding Try out left the pill with
  nowhere to go, so it was permanently a dead `<span>` in the common case.
  `postAccountCycle` now returns `[Try out, ...connected platforms]` in the
  Generate menu's own order, and `nextPostAccount` returns a
  `PostAccountTarget` (`{platform, isTryout}`) rather than a bare platform.
  A Try out position **carries the post's own platform**, so switching to it
  and back is lossless — verified live: cycling to Try out and querying the row
  gives `is_tryout: true` with `platform: linkedin` intact.
  - `updatePost`'s patch schema gained `isTryout`; every call site writes the
    pair together, since a try-out post still has a real platform.
  - `GeneratedPost` (generating-view) gained its own `isTryout` — it was a
    batch-level prop, but a card can now be switched individually.
- **`components/shared/post-account-pill.tsx`** — the pill markup was about to
  exist in three places, so it was extracted first. Button when `nextAccount`
  is non-null, plain span otherwise (which now only happens with *no*
  connected accounts, Try out being the only position). GeneratedPostCard,
  KanbanPostCard and PostDetails all render it.
- **Post-details rebuilt to design-sync/contentpagenew.** The export's
  `Frame 2147239385` is `align: CENTER` holding a 400px HUG column
  (`x=228` in an 856 parent) whose own children are all `align: MIN` at `x=0` —
  so one centred column with heading, account/topics row and body **all flush
  to that column's left edge**. Previously the heading was its own hugging,
  centred block, so it floated over the body instead of lining up with it.
  Verified in the DOM: panel centre 1168, column left 968 w 400 (centre 1168),
  and h1/body both starting at exactly 968.
  - The account pill + topic chips row (the export's `Frame 2147239341`,
    dist-md gap) is new on this page — it had neither before. The pill box is
    byte-identical to the cards' (surface-3, border-subtle at stroke-lg,
    rad-md, pad-xs/pad-sm, dist-sm), which is why the shared component covers
    all three.
  - `calendar/[postId]/page.tsx` now `Promise.all`s post + accounts +
    instructions, same as the Content page.
- Verified in-browser on :3001 against one temporary post (deleted after):
  pill cycles Godwin John → Try out → Godwin John and persists; retired chip
  ("Growth hacking") still visibly distinct from the live one ("Leadership");
  Kanban cards unchanged after the pill extraction.
- Automation note: the first attempt to click "Move to drafts" by screenshot
  coordinates missed — the screenshot is 1437px wide against a ~1796px DOM
  viewport, and that ratio is not the only scaling in play. `find` + click by
  `ref` is the reliable path, and the empty observer log (no `click` entry at
  all) is what exposed the miss rather than a wrong result.
- **Post-details topic chips use `text-bold`** (direct request), matching the
  export's own label fill. Scoped to that screen via `className` rather than
  changed on `Chip`: everywhere else an unselected chip is secondary to what it
  sits beside, but here the topic is one of only two things describing the
  post. A **retired** chip keeps its `text-minimal` — the point of that state is
  that the topic has faded out of the project, which a bold label would undo.
  Confirmed `cn()` resolves the override (colour swapped, `text-body-md` kept)
  before relying on it.
- **Regenerate modal gains a topic picker** (design-sync/regeneratemodalwithtopic
  — its `Frame 2147239356` is the model pill's frame with a different label, so
  it reuses SelectPill with the same surface-4/border overrides). Regenerating
  is the right home for this: it's the one action that rewrites the post
  outright, so a new subject produces words that actually match it — changing a
  topic anywhere else would leave the label disagreeing with the post.
  - Options are the post's own topic first, then the project's, deduped. The
    pill is hidden entirely when there's nothing to choose between.
  - `app/api/regenerate-post` takes an optional `topic` (≤80 chars), uses it in
    the prompt, and writes `topics` back **only when it actually changed** — so
    an untouched reroll doesn't rewrite the column and a topicless post doesn't
    silently gain one. Applied to both persistence sites (the TasteTest
    shortcut and the stream's `onEnd`), which meant hoisting the computation
    above the TasteTest early-return — TS caught that as a TDZ error.
  - post-details patches `topics` locally after a clean finish, since the text
    stream can't carry the field back.
  - Verified end-to-end on TasteTest: picked "Personal branding" over "Product
    management", and the row went `["Product management","Growth hacking"]` →
    `["Personal branding"]` with fresh content, the chip updating in place.
- **A false alarm worth recording**: both chips on the test post rendered
  retired, and I suspected a `Set` failing to cross the RSC boundary. A
  temporary `data-probe` on the server component showed the truth — the project's
  topics are now `["Product management","Personal branding"]`; **"Leadership"
  had been deleted from Instructions since yesterday**, so retired was correct.
  The prop was switched from `Set<string>` to `string[]` anyway (built into a
  Set inside the client component, exactly as ContentView already does) — it's
  the shape the codebase already uses across that boundary, so the two screens
  now agree.

## 2026-08-25 — post-details: error handling audit for regenerate

Audited every failure path on the post-details page. Already handled correctly:
a pre-response `fetch` throw, a non-ok response, a mid-stream *model* error
(STREAM_ERROR_MARKER), a read throwing mid-stream, and the server skipping
persistence on a failed stream. The Regenerate button is disabled while a run
is in flight, so there's no concurrent-stream path. Five real gaps found:

1. **A hung agent never resolved.** No timeout and no abort anywhere: if the
   model accepted the connection and then went silent, `reader.read()` waited
   forever, leaving the page looping "generating post . . ." with no error and
   no way out but a reload. Fixed with `STREAM_STALL_TIMEOUT_MS` (45s), reset on
   every chunk so a slow-but-alive generation is never cut off. **Verified by
   simulating a stream that delivers one chunk then goes silent: aborted at
   45,995ms with "That took too long to generate", heading cleared.**
2. **A cleanly-truncated stream was indistinguishable from success.** The
   framing only marked *model* errors; a severed connection (a function hitting
   its duration ceiling, a proxy idling the socket) ends the response cleanly,
   and the client would treat whatever had arrived as the finished post and
   write it into its own state while the server persisted nothing — the exact
   drift STREAM_ERROR_MARKER exists to prevent, reached another way. Added
   `STREAM_DONE_MARKER`: the stream now always ends with exactly one of the two,
   and a body carrying neither is rejected. **Verified by stripping the marker
   in flight: "The connection dropped before that finished", original content
   untouched.**
   - The TasteTest shortcut returns a plain `Response` that bypasses the framed
     stream, so it had to emit the marker too — caught before shipping; without
     it every TasteTest regenerate would have failed.
3. **An empty completion wiped the post.** A stream can end "successfully" with
   no text (a safety stop, a zero-length completion) and the route persisted
   `content: ""` — the raw update has none of `updatePost`'s `min(1)` guard.
   Now `!end.content.trim()` is treated as a failure, and the framed stream
   emits the *error* marker when nothing was produced.
4. **No `maxDuration`.** Next's default is "set by the deployment platform"
   (verified in node_modules/next/dist/docs) — 10-15s on Vercel, shorter than a
   real generation, so the function would be killed mid-stream on ordinary use.
   Declared `export const maxDuration = 60` (Hobby-tier max).
5. **No abort on unmount.** Navigating away mid-stream left the read loop
   running and calling setState on a gone component. An AbortController in a ref
   is now aborted by the unmount cleanup; the catch distinguishes that from a
   timeout (`timedOut`) and stays silent, since there is nobody to tell.

**Residual gap, not fixed — flagged to the user.** The server can persist while
the client rejects the response (most clearly on the TasteTest path, which
writes *before* responding), leaving the page showing stale text until a
reload. `router.refresh()` alone wouldn't fix it: `currentPost` is local state
seeded once from the prop and never re-syncs, and adding a props→state effect is
the pattern this codebase lints against (`react-hooks/set-state-in-effect`).
Worth a deliberate decision rather than a reflex fix.

Also recorded in LEARNINGS: `innerText` reads empty from a `javascript_tool`
eval (backgrounded tab, no layout) — it made two probes report a working toast
as missing. Use `textContent`.
- Regenerate's error toasts split onto the `extraInfo` capsule (per direct
  feedback that they were too long), the same what-happened/what-to-do shape
  the offline toast uses: "That took too long" / "Please try again",
  "The connection dropped" / "Try reloading". `showError` takes a second
  argument and PostDetails' toast state carries `extraInfo` through to Toast.
  The mid-stream model-error message was split the same way for consistency
  ("Couldn't regenerate that post" / "Please try again") — it keeps *try
  again* rather than *reload* because that path definitively skips persistence
  server-side, so retrying really is the whole recovery. Verified in-browser by
  cloning the toast node on appearance (it auto-dismisses in 4s, well inside
  one tool round-trip): both lines present, capsule carrying the export's own
  `-mt-dist-xs` tuck.
- Handoff gates: tsc clean, build clean. Lint reports 17 errors — proven
  **identical file-for-file to a stashed clean HEAD**, so this branch adds
  none. `npm run test` is 100/101: `lib/ai/generate.test.ts` makes a *real*
  Gemini call (guarded only on the API key being present) and the free tier's
  daily cap of 20 requests is spent, so it 429s. Environmental, unrelated to
  this branch, and not recoverable today.
- Found while preparing the commit: `lib/ai/generate.ts` is classified binary
  by git because of the markers' NUL bytes, so its diff rendered as
  "Bin 10818 -> 11558 bytes" and would have been invisible in review. Added
  `lib/ai/generate.ts diff` to `.gitattributes` — content untouched, diff now
  renders as the 11 lines it actually is. Written up in LEARNINGS.

## 2026-08-25 22:43 — post-accounts: review fixes from /integrate

The sweep bounced this branch with three blockers in the regenerate protocol
and four smaller items. All seven fixed in place; the account work itself was
untouched.

1. `route.ts` framing tee tested `part.text.length > 0` while the persisting
   tee tested `!end.content.trim()`. A whitespace-only completion passed the
   first and failed the second, so the client got DONE, accepted it, and
   rendered an empty post that was never saved — a reload brought the old text
   back. Now trims, so the two predicates agree exactly.
2. `post-details.tsx` aborted the request on unmount, which severs the request
   the route handler runs in: its onEnd sees `ok: false` and persists nothing.
   Tapping Back a second after Regenerate threw away a finished generation and
   its token spend. Replaced the AbortController-on-unmount with a
   `{ cancelled }` flag (generating-view.tsx's shape) — the read loop runs on
   to keep the connection open, it just stops calling setState. The controller
   remains, now tripped only by the stall watchdog, so an abort unambiguously
   means "we gave up waiting".
3. STREAM_DONE_MARKER meant "the stream ended", not "it was saved" — enqueued
   in the framing tee's `finally` while the write happened on the other tee.
   The two now synchronise through a `persisted` promise settled on every path
   through onEnd (including a throw); DONE is only sent when the row actually
   took the update. Short-circuited when the framing tee already knows it
   failed, and backstopped by PERSIST_WAIT_TIMEOUT_MS so a callback that never
   fires can't hold the response open to the function's own ceiling.
4. The "Moved to draft" toast raised its Undo before the move's write was
   issued, so two updatePost calls could race on one row and leave the DB
   scheduled while the page showed a draft. The write is now issued first and
   its promise handed to Undo, which awaits it before issuing the restore. The
   toast still goes up in the same tick — nothing is awaited between them.
5. `post-account-pill.tsx` used `transition-[colors,scale]`; `colors` is not a
   CSS property, so the hover tint snapped. Now `background-color`, matching
   toast.tsx:275's identical recipe.
6. `route.ts`'s post select still hardcoded the old eight columns and then cast
   to the widened `PostRow`, leaving `is_tryout` undefined typed boolean — the
   exact staleness POST_COLUMNS was introduced to stop. Now uses POST_COLUMNS.
7. Removed the unused `PostPlatform` import in day-deck.tsx (the branch's one
   new lint warning).

Gates after: tsc clean, eslint clean on all four touched files, build clean,
tests 100/101 — the one failure is lib/ai/generate.test.ts hitting the live
Gemini free-tier quota, environmental and unrelated (it fails the same way on
main).

## 2026-08-26 07:08 — dashboard: merge fixes, and the "Try out" row made real

Merged `main` into the branch (no conflicts; the union-merge files sorted
themselves out) and fixed what only shows up once main's types are present.

**The merge-blocking one.** `lib/dashboard-summary.test.ts`'s `post()` factory
built a `Post` with no `isTryout` — a field `main` added *after* this branch's
merge base. The branch typechecks alone and fails on merge (`TS2322`,
`undefined` not assignable to `boolean`). vitest doesn't typecheck, so the
suite stayed green and `npm run build` was the first thing to break. This is
the general trap: **branch-local gates cannot see a required field added to a
shared type on main.** Reproduced, then fixed with `isTryout: false`.

**The "Try out" row is now real.** It had been hardcoded to `count={0}` while
`platformSplit()` counted try-out posts under `linkedin` — so a project
generating only try-out posts rendered "LinkedIn - N posts - 100%" beside
"Try out - 0 posts - 0%". Not a neutral placeholder: an actively wrong
attribution. `PlatformSplit` is now keyed on `PostPlatform | "tryout"` and
`platformSplit()` partitions on `post.isTryout` *before* platform, the same
precedence `lib/post-account.ts` uses to resolve the same post to Eyes +
"Try out" rather than the user's LinkedIn name. Three tests pin it: every row
present when unused, a try-out post landing in its own row and not under its
platform, and the three counts staying disjoint and summing to the total.
FOLLOWUPS entry 2 deleted, since it is done.

**"Written this week" no longer claims a subset it isn't.** The value is a
rolling 7-day count; the caption divided it by a calendar-month total, so for
the first week of any month the numerator can exceed the denominator
("6 of 1 total this month"). Numerator left honest, caption reworded to two
plain figures with no implied subset.

Gates on the merge result: tsc clean, eslint clean, build clean, **118/118
tests** — including `lib/ai/generate.test.ts`, which passed for the first time
in this session now that the Gemini free-tier quota has reset (it was the
single failure on the last three sweeps, environmental throughout).

Not done, and deliberately: the dashboard page still ships every post's full
`content` into a client component to render 12 cards and some counts, which is
a real payload concern at scale but a restructure rather than a fix. Left as a
review finding.

## 2026-08-26 — Two small fixes on main (no branch, by request)

**1. "Try out" is a Content-page filter value.** `PlatformFilter` gained a
`"tryout"` position and the Social row's cycle became
all → LinkedIn → X → Try out → all. The matching is a new
`matchesPlatformFilter`, which checks `isTryout` *before* platform — the same
precedence `lib/post-account.ts` resolves a pill by and
`dashboard-summary.ts`'s `platformSplit` counts by — so the three values are
disjoint and, crucially, picking LinkedIn no longer hands back the try-out
posts that borrow LinkedIn as their platform. In the menu, "Try out" draws the
Eyes glyph (`PlatformFilterIcons` in content-filter.tsx) rather than a brand
mark, matching post-account-icon.tsx and the dashboard's own platform bars.
Verified in-browser on Design content's Draft tab: All → 17 drafts,
LinkedIn → the 3 real ones only, X → the empty-filter state, Try out → the 14.

**2. The dashboard's "What you're posting about" was counting Try out as 0.**
Not a bug in `platformSplit` (which already partitions on `isTryout`) but in
what it was handed: `dashboard-view.tsx` passed `monthPosts`, which is
scheduled-only, and **every try-out post is dateless** — the Try out flow
writes posts, it never schedules them. New `postsInMonth` in
dashboard-summary.ts takes a scheduled post by its date and a dateless one by
when it was written (the same rule the Content page's Draft tab groups by), and
the card now reads that set. Its topic chips pick up the same posts, which they
were also missing. The calendar and coverage figures still use the
scheduled-only set — those are scheduled-only by nature. Verified in-browser:
that row went from "0 posts • 0%" to "Try out • 14 posts • 42%", with LinkedIn
at 19 and the two summing to the card's total.

Gates: tsc clean, `lib/content-filter.test.ts` 19/19 and
`lib/dashboard-summary.test.ts` 19/19 (four new tests across the two, covering
the cycle, the isTryout-before-platform precedence, the stored value round-trip
and `postsInMonth`'s two halves). Full suite 123/124 — the one failure is
`lib/ai/generate.test.ts`, a live Gemini call, environmental and untouched
here. `npm run lint` reports 17 pre-existing `react-hooks/refs` errors in files
this change doesn't touch (switch.tsx, generate-calendar-column.tsx, others);
no new ones.

**Follow-ups on the same filter row, per direct feedback.** (a) The "All" value
now draws the Try out mark alongside the two brand ones — `PLATFORM_ICONS` maps
each filter value to *the values it covers* rather than to platforms, so `all`
is `["linkedin", "x", "tryout"]` and one branch in `PlatformFilterIcons`
renders Eyes wherever that entry appears (the `PostPlatform` import went with
the old shape). (b) The Eyes glyph read smaller than its neighbours, and it
was: measured in the live DOM, three identical 16px boxes paint 16.0×16.0
(LinkedIn's mark fills its square edge to edge), 14.7×13.3 (X) and 13.5×12.5
(Eyes). Boxes matching is not glyphs matching. Eyes is now `size-4.5` (18px),
which paints 15.2×14.1 — between the other two — the same optical-fit reasoning
as FilterCheckbox's `size-3.5` Check inside its 20px well. The other Eyes call
sites (post-account-icon.tsx, the dashboard's PlatformRow) are untouched, since
nothing sits a brand mark beside them in the same row.

**The filter menu's topic list lost its scrollbar thumb, per direct request.**
`useScrollThumb`/`ScrollbarThumb` are gone from content-filter.tsx, along with
the `relative` wrapper that only existed to position the thumb and the callback
ref that composed the two hooks onto one node — `useScrollFade` now owns the
list's ref and scroll handler outright. `HIDE_NATIVE_SCROLLBAR_CLASSNAME`
stays: hiding the native bar is the standing rule (AGENTS.md Conventions),
showing a custom one is the per-container call, and this container now makes
the same call the page-level `<main>` did. The top/bottom edge fades are what
signal there's more to see. Verified in-browser: the list still scrolls under
the wheel, no thumb appears, and both fades still track the remaining scroll
distance.

## 2026-08-26 — Dashboard: empty post sections, wider section spacing, no CTA

Built from `design-sync/emptydashboardpostsection` (read via the figma-bridge
skill — frame.json + screenshot, no REST/MCP).

1. **The empty tray.** `PostList`'s empty branch in next-up-column.tsx was a
   grey one-liner ("Nothing scheduled ahead."); it is now the export's 200px
   `surface-2` `rad-xmd` tray (squircle-clipped like every other radius here)
   with the empty-state block centred inside at `pad-2xl`. `emptyLabel` became
   `emptyTitle`, since the string is now the loud Phudu line rather than a
   caption.
2. **`EmptyState` gained `size="sm"`** rather than a second component: the
   export draws the same icon/caption/title stack, just at 32px / `dist-md` /
   `title-lg` instead of 48px / `dist-lg` / `heading-sm`. Two components for
   one layout would drift. The compact title renders as `<p>` — inside the
   column it sits under an `<h3>`, so the full-size `<h1>` would be wrong.
3. **Spacing → `dist-2xl`**, per request: DashboardView's top-level gap
   (`dist-xl` → `dist-2xl`) and the gap between the two post sections in
   NextUpColumn (`dist-lg` → `dist-2xl`, which is also what the export's own
   root frame specifies).
4. **"Get started" is gone** from the zero-posts dashboard, per request. The
   `Button` import went with it; `EmptyState`'s `action` slot stays for
   whatever wants it later.

Verified in-browser against the export by measuring the live DOM: tray 200px,
`rgb(231,223,220)` = surface-2, 32px padding, 12px radius *with* a clip-path
applied, 32px Eyes, 14px text-subtle caption, 22/28 Phudu title at 272px, 8px
gaps — every value the frame.json specifies. The empty branch was exercised by
temporarily passing `upcoming={[]} recent={[]}` (backed up and restored; the
one project with posts has both lists populated). The zero-posts dashboard was
checked on a real empty project — icon, caption, title, no button.

Gates: tsc clean, **124/124 tests** (the Gemini live test passed this run),
eslint clean on every touched file — the one error in the touched *directories*
is project-sidebar.tsx's pre-existing `set-state-in-effect`, untouched here.

**A try-out post in the Next-up / Recently-out lists wore the LinkedIn mark.**
`DashboardPostCard` keyed its icon off `post.platform` alone, and a try-out
post carries a real platform — so it was badged with the user's connected
LinkedIn. Now `isTryout` is read first, exactly as `resolvePostAccount` and
`platformSplit` do, and a try-out post gets the Eyes glyph. The flag is all
this card needs, since it shows a mark and no account name (the full
resolution wants a `social_accounts` list this card isn't handed).

Sized `size-7` (28px) against the brand marks' `size-6`, for the reason found
in the filter menu earlier: Eyes paints ~84% of its own box where the LinkedIn
mark fills its square edge to edge, and here the cards stack, putting the two
in a column at the same x. Verified in-browser on the one scheduled try-out
post in the DB.

Also corrected a claim this file and lib/dashboard-summary.ts made last round —
"every try-out post is dateless" is how they *start*, not an invariant: 1 of
the 5 try-out posts in the DB now carries a date. `postsInMonth` covers both
halves, so nothing about it changes.

**Today no longer hides its own posts on the dashboard calendar.** `DayCell`'s
`state` had `"today"` as a fourth mutually-exclusive value, so a day that was
both today *and* had posts rendered as the white-with-orange-ring today cell —
losing the purple that every other day with content carries. `state` is now
just the fill a day earns (`content` / `empty` / `adjacent`) with `isToday` as
a separate flag that adds the ring on top, per direct request. Today with
nothing on it still takes `surface-rest` white rather than the grey of an
ordinary empty day: the ring needs something to sit against. Verified
in-browser — the 26th renders purple with inverse text inside the orange ring,
flush with its neighbours.

## 2026-08-26 — Generate: the chrome locks while a run is in flight

Per direct request: leaving the generating page unmounts the view, and that
unmount *is* what ends the run — so a sidebar tab or the navbar's Back arrow
silently threw away whatever was left to generate. Both are now dimmed and
non-interactive for exactly as long as the run lasts.

- `lib/generation-lock.ts` — a module-level store in the shape of
  lib/network-status.ts / lib/section-navigation.ts. Context wasn't an option
  in any honest form: the writer is a page component and the readers are two
  pieces of chrome *above* it in the tree, so a provider would have had to be
  threaded through the project layout to connect them.
- `hooks/use-generation-lock.ts` — the `useSyncExternalStore` read plus the two
  class constants, so both pieces of chrome dim identically instead of the
  treatment being written twice.
- **`inert`, not `pointer-events-none`.** The latter blocks the mouse and
  nothing else: Tab + Enter would still walk into the sidebar and navigate away
  mid-run. `inert` takes the subtree out of the tab order and out of the
  accessibility tree as well. React 19 renders it as a real attribute, so no
  ref work is needed.
- The dim is `opacity-40` on a 300ms `ease-out` fade rather than a hard cut —
  the lock lands the instant Generate is pressed, and snapping there reads as a
  glitch.
- Released on `status !== "generating"` (Stop, completion) *and* on unmount, so
  the lock can never outlive the page that set it — Close, a failed run that
  navigates itself away, or a route error would otherwise leave the app's
  chrome permanently dead.
- `lib/generation-lock.test.ts` pins the store: default false, notify on
  change, **no** notify on a repeat write (Stop → Resume → Stop shouldn't
  re-render the chrome for a value it already holds), and silence after
  unsubscribe.

Verified in-browser through the real in-app path (Generate → "Generate posts"):
mid-run at 4/12 with Stop showing, both the sidebar card and the navbar render
at 40% while the page itself stays crisp, and a click on the Dashboard tab does
nothing at all — the URL stays on /generating. The chrome comes back the moment
the batch finishes.

Gates: tsc clean, eslint clean on every new file, **128/128 tests** (4 new).

**"What you're posting about" was reporting a month, not the library.** Chased
from a report that LinkedIn showed 26 for a project that plainly has more.
Nothing was miscounted: the card was fed `postsInMonth(posts, now)`, so 26 =
19 scheduled in August + 7 undated written in August, with 16 September and 30
November LinkedIn posts outside the window. The Try out figure looked right
only by coincidence — 88 is also August-only, missing 19 try-out posts
scheduled for October.

The card now takes every post. Its title carries no month, it sits under a
globally-scoped Total-posts bar, and "what you write about" is a property of
the library rather than of a calendar page. `postsInMonth` (added earlier today
for the Try-out-shows-zero fix) has no callers left and is deleted along with
its tests — a global set covers undated posts by definition, which is what that
helper existed to do. The calendar card and coverage stats keep their own
month-scoped set, which is `monthPosts`, untouched.

Verified in-browser: LinkedIn 72 · 40%, X 0, Try out 107 · 60% — summing to the
project's 179, and matching the DB exactly (19+7+16+30 and 88+19). Gates: tsc
clean, eslint clean, 126/126 tests.

**The Total-posts card now counts one thing.** Per direct request (option 1 of
three offered): its Queued and Published mini cards read the project-wide
`totalsByState` figures instead of the reference month's, so the card's bar,
legend and three tiles all describe the same set — 104 / 85 / 9 of 198, where
Queued and Published used to say 10 and 9 "of 19 this month". `TotalPostsCard`
lost its `monthScheduled`/`monthQueued`/`monthPublished` props entirely; the
month still has the row below and the calendar.

Two more, same request: "Still to go out" is now **"To go out this month"** (it
was the one month-scoped figure whose label didn't say so), and its caption
drops the word "queued" — "of 19 scheduled in August" — which would otherwise
have meant something different from the Queued tile directly above it. The stat
row reorders to **To go out this month → Empty days ahead → Written this week**,
putting the two calendar figures side by side and the activity figure last.

Verified in-browser against the DB: 104 drafts / 85 queued / 9 published of 198,
"To go out this month 10, of 19 scheduled in August". Gates: tsc clean, eslint
clean, 126/126 tests.

(Aside worth noting: the first load after this edit landed on `error.tsx` — an
HMR hiccup, not the change — and its "Try again" button recovered the page in
one click, which is the first time that recovery path has been exercised for
real rather than by forcing a throw.)

## 2026-08-26 — Profile reachable from the name chip; gear retired

`feat/settings-profile`, port 3002. The branch's original brief (fold Profile
*into* Settings, since nothing linked to /profile) is superseded: Profile
becomes the screen the navbar's name chip opens, and the gear goes away.

1. `app/projects/[projectId]/profile/page.tsx` now renders the in-project
   section loading screen — `SectionSpinner` centered in a `flex-1` box, the
   same markup `app/projects/[projectId]/loading.tsx` uses — as a deliberate
   placeholder until the Figma export lands. Its old heading/paragraph and
   Log out form are gone; `logout-button.tsx` **stays**, because
   `settings/page.tsx` imports `LogoutButton` from this folder.
2. `components/projects/projects-navbar.tsx`: the gear button is deleted
   (`Gear`/`GearFine` imports with it), and the user chip is now the `<Link>`
   into Profile — a `Link` carrying the squircle ref (typed
   `HTMLAnchorElement`) plus the app's standard 150ms `active:scale-[0.97]`
   press feedback. The `settingsHref` prop became `profileHref`.
3. `components/shared/project-topbar.tsx` and
   `app/projects/[projectId]/layout.tsx` follow the rename; the layout now
   passes `/projects/${projectId}/profile`.
4. New `app/profile/page.tsx` — the same redirect stub `app/settings/page.tsx`
   already was, for the same reason: the /projects navbar has no project in
   scope, so the chip there forwards into the first project's profile.

Verified in-browser on :3002 — no gear on either navbar, the chip on /projects
lands on `/projects/<id>/profile` via the stub, and that page shows exactly the
section spinner. Gates: tsc clean, eslint clean on the touched files, 126/126 tests.

**One flaky test caught while checking those gates**, worth knowing about:
`lib/ai/generate.test.ts` makes a *real* Gemini call and vitest's default 30s
timeout is not always enough — it failed twice, passed on clean HEAD, then
passed again with the same changes applied. Not caused by anything here (none
of these files are in that test's import graph), but it means a red suite on
this branch should be re-run before it's believed. Logged in FOLLOWUPS.

**Left undone, flagged to the user:** the gear was the only UI route to
Settings, so Settings is now reachable by URL only. See FOLLOWUPS.md.

### Same day, follow-up — Settings merged into Profile

The spinner placeholder above was doing exactly what it looked like: loading
forever. Replaced by the actual merge, which is the branch's original brief
run in the opposite direction (fold Settings *into* Profile, not the reverse —
Profile is the screen the name chip now opens, so it's the one that should hold
the content).

1. `profile/page.tsx` is now Settings' old body verbatim — `AiModelsCard` +
   the Log out form, same `@starting-style` mount-in — and takes `params` for
   the `projectId` the card threads to its server actions.
2. `settings/page.tsx` became a redirect to `../profile`, and the top-level
   `app/settings/page.tsx` stub now forwards to the first project's *profile*.
   Kept as redirects rather than deleted so bookmarks and any stale link land
   on the screen that holds the content.
3. `model-actions.ts`'s two `revalidatePath` calls repointed to `/profile`.
   The file itself stays under `settings/` — its path is an implementation
   detail imported by three `components/settings/*` files, and moving it would
   be churn for no behavior change.
4. The dashboard's setup checklist: `hrefs.settings` → `hrefs.profile`
   (renamed, not just repointed, in both `dashboard/page.tsx` and
   `dashboard-view.tsx`).
5. `PROTECTED_PREFIXES` in `lib/supabase/middleware.ts` gained `/profile`.

Verified in-browser on :3002: `/projects/<id>/settings` lands on `/profile`
showing the AI Models card and Log out; a DOM sweep for `a[href*=settings]`
comes back empty, with both the name chip and the dashboard's "AI Model" row
pointing at `/profile`. Gates: tsc clean, eslint clean. FOLLOWUPS' "Settings
has no UI entry point" entry is deleted — this is what resolved it.

### Same day, follow-up — Profile mocked up

No Figma export exists for Profile (checked all of design-sync/), so this is a
placeholder to be restyled when the frame lands. It borrows the Instructions
page's three-column rhythm and `InstructionsCard` shell, which is already the
app's generic card despite the name.

Three cards: **Account** (avatar + name + email header, an editable Name field,
"Member since"), **Security** (Change password → the existing forgot-password
flow, Log out), and the **AI models** card the merge brought over.

Everything on it is really wired — nothing is a dead control. The only new
server action is `profile/account-actions.ts`'s `updateDisplayName`, a
blur-save onto `auth.users`' `user_metadata.name` (Supabase scopes
`updateUser` to the caller's session, so there's no ownership check to make).
It revalidates the **layout** segment, not just the page: the navbar chip
renders from the layout's own `getUser()`, so a page-only revalidate would
leave the chip on the old name.

**One bug found and fixed in the making:** the Name field started as
`defaultValue={name}`, and a successful save revalidates this route — so the
prop came back *changed* under an uncontrolled input, which is exactly what
Base UI warns about ("changing the default value state of an uncontrolled
FieldControl"). It's now controlled, with a `savedName` ref holding the last
value the server accepted so a blur that changed nothing doesn't fire a save.
Worth knowing generally: the Instructions fields get away with uncontrolled
blur-saves because none of them revalidate a path whose props feed the field.

Also dropped a duplicate — email was rendering both in the card header and as
a fact row below.

Verified in-browser on :3002: name saved, header and navbar chip both picked it
up, restored to its original value, and the console shows no new Base UI
warning after the fix (the two in the buffer are stale, timestamped before it;
the dev overlay's issue badge is gone). Gates: tsc clean, eslint clean.

## 2026-08-27 — Profile rebuilt from the `profilescreen` export

The mock is gone; this is the real frame (design-sync/profilescreen). One
centred column on the plain surface-3 canvas — no GlowPanel, same as
Connections, whose "Connection - connected" frame this one was duplicated from
(the export still carries that node name).

Layout, all measured against the export and verified in-browser: header block
272×104 (40px avatar, dist-md, then heading-sm/Phudu name over a body-md
"Member since …" at dist-sm), the connection pill, three 312×40 surface-4 rows
at dist-md, then the log-out button — the four blocks at dist-lg.

- `components/profile/profile-row.tsx` — the menu row. **The caret follows the
  destination, not the styling**: the export draws the dotted rule and caret on
  the two rows that lead somewhere and omits both from "Replay onboarding",
  which acts in place, so `href` vs `onClick` is what decides. The rule is the
  existing `DottedDivider` as a `flex-1` filler — the export's own line asset
  is the same 0.5/4 round-cap dash it already draws. Link and button can't
  share one element: `useSquircleClipPath` is typed to the node it measures.
- `components/profile/profile-screen.tsx` — composes it, plus the red power
  button. Its glow is the export's filter read literally (dilate 4, dy 4,
  stdDeviation 8 → a 16px CSS blur, #a20000 at 20%): `0 4px 16px 4px
  rgba(162,0,0,0.2)`. Not a token, same exception as the app's other literal
  shadows.
- Icons are all Phosphor and match the exported SVGs one for one: Password,
  Robot, ArrowArcLeft, CaretRight, Power. No asset was copied.
- **`ConnectionCountBadge` moved out of connections-panel.tsx** into
  `components/shared/connection-count-badge.tsx` — the export puts the same
  pill on this screen, and the count is real (live connections, not rows;
  expired tokens don't count, matching the Connections page's own rule).
- **"Replay onboarding" is now part of the design.** It calls the same
  `restart()` the dashboard's understated dev button does. That button is now
  redundant but left in place — removing it wasn't asked for.

What the export removed, and so this did too: the email, and the editable name
field. `profile/account-actions.ts` (`updateDisplayName`) went with it, along
with the mock's `account-card.tsx` / `security-card.tsx` — all three were from
yesterday's placeholder, which this replaces wholesale.

**The one thing the export doesn't specify: where "AI models" goes.** Its row
has a caret, so it leads somewhere, but there's no frame for the destination.
Built as `profile/models/` — the existing `AiModelsCard` on Profile's own
centred rhythm with a back button. Restyle if a frame turns up.

Verified in-browser on :3002 against the export: rows 312×40 at rad-lg with the
squircle clip applied and surface-4 (#fffffe), header block 272×104, name 27px
Phudu, outer gap 16px — all exact. Both interactions work: "AI models" reaches
the sub-page and comes back, "Replay onboarding" brings up the tour cover.
Gates: tsc clean, eslint clean, 126/126 tests.

### Same day — the expanded state (`profilescreenexpanded`)

Change password and AI models are no longer links: they expand in place. That
retires the `profile/models/` sub-page invented last round (the caret did lead
somewhere — just not to another screen) and `ai-models-card.tsx` with it.

- `components/profile/profile-disclosure.tsx` is the animated row.
  **Height animates via `grid-template-rows: 0fr → 1fr`.** Two reasons, both
  from `.agents/skills/review-animations/STANDARDS.md`: an accordion has to
  change layout height or it can't push the rows below it, so the standards'
  transform/opacity-only rule can't be followed literally here; and it's a
  *transition*, which the standards call for on anything triggerable rapidly —
  it retargets from wherever it is mid-flight, where keyframes restart at zero.
  - **Durations are asymmetric**: 220ms open, 160ms close. Both sit in the
    standards' 150–250ms "dropdowns, selects" band, and closing is faster per
    "slow where the user is deciding, fast where the system responds."
  - **Easing is the standards' strong ease-out**, `cubic-bezier(0.23,1,0.32,1)`,
    in *both* directions — never ease-in on UI. Written literally at each use;
    Tailwind only sees class strings it can read in the source.
  - **The content's fade is offset from the height change rather than parallel
    to it**: opening it waits 60ms for room to appear in, closing it runs with
    no delay so it's gone before the edge reaches it. Otherwise text smears
    against the collapsing boundary. 140ms either way, opacity + translate
    only.
  - **The caret rotates instead of swapping glyphs** — the export's CaretUp is
    its CaretRight a quarter turn anticlockwise, so `-rotate-90` covers it, and
    a rotation is a transform per the performance rule.
  - **`inert` when closed, not `hidden`**: the panel has to stay in layout for
    its height to animate. Verified `input.focus()` doesn't land in a closed
    panel.
  - Reduced motion drops the height and translate and keeps the fade —
    "fewer and gentler, not zero."
- `components/profile/change-password-panel.tsx` + `changePassword`
  (profile/account-actions.ts). **Supabase has no "verify this password" call,
  so re-authenticating is the check** — `signInWithPassword` with the old one,
  then `updateUser`. On success that just refreshes the same user's session; a
  wrong guess leaves the existing session alone, so it can't sign anyone out.
  Deliberately no `signOut` afterwards, unlike the recovery flow, which ends a
  *recovery* session. Network failures are separated from "wrong password"
  per lib/network-error.ts — the offline toast owns those, not the field.
- `ai-models-card.tsx` → `components/settings/ai-models-panel.tsx`: same
  add/delete behaviour, minus the InstructionsCard shell. The card used to move
  the "+" into its header once entries existed; the disclosure header has no
  room beside the caret, so the full-width button stays at the foot and the
  list grows above it — matching the export exactly when empty. `AddModelModal`
  gained a `block` trigger for that full-width `xl` button.
- **Icons are `icon-subtle` throughout**, per direct request — the row icons
  were `icon-bold`.
- `ProfileRow` lost its link variant: with both caret rows now disclosures, the
  only plain row left is Replay onboarding.

Verified in-browser on :3002 against the export: Change password card 312×188,
AI models 312×180, Replay onboarding 312×40, icon colour rgb(119,112,109) =
`--icon-subtle` — all exact. Both settled states check out: open →
`grid-template-rows` resolves to 148px/140px, transition 220ms on the strong
ease-out, content 140ms at 60ms delay, caret −90deg; closed → 0px, 160ms, 0ms
delay, caret cleared, `inert` true and focus genuinely blocked.

**Not verified: a mid-flight frame.** Every `javascript_tool` eval backgrounds
the tab, and that suspends the transition — `transitionrun`/`start`/`end` never
fired, `getAnimations()` came back empty after a click, and a 3s slow-motion
override still screenshotted fully settled. AGENTS.md already documents this
for rAF-driven animation; it applies to CSS transitions and their events too
(added to LEARNINGS). The declarations and both endpoints are confirmed; the
interpolation between them is inferred, not seen.

**Also unexercised: the password change itself.** The form and its states are
verified, but submitting means entering a real credential, which I don't do.

Gates: tsc clean, 126/126 tests. eslint reports 17 errors, all pre-existing —
confirmed by stashing this work and re-running against HEAD, which reports 19;
none of the flagged files are new here.

### Same day — log-out confirmation, pill removed, wider gap

Three items, all by direct request.

1. **Log out asks first.** The power button no longer submits; it opens
   `components/ui/confirmation-modal.tsx` — the app's existing pattern (Figma
   "DefaultConfirmationModal"), already used by the delete-post and disconnect
   flows, and already carrying the danger top-right X as its dismiss, so
   nothing new was built. Icon is Power, matching the disconnect modal's own
   rule that the icon shows the state the button leads to. The modal can't be
   dismissed while the sign-out is in flight: `logout` redirects, so closing
   early would just show a dead page for a beat. That also means the pending
   flag is never cleared on the success path — by design, the page is gone.
2. **The "n connections active" pill is gone** from Profile. `connectionCount`
   and the page's `fetchSocialAccounts` call went with it — nothing else on
   this screen used them. `ConnectionCountBadge` stays in components/shared/:
   the Connections screen still renders it, which is where it earns its keep.
3. **32px between the menu and the log-out button** (`mt-dist-lg` on top of the
   column's own `dist-lg`), against the export's 16px — by request. Measured
   in-browser at exactly 32.

Verified in-browser on :3002: the dialog opens with the Power icon, "LOG OUT",
the copy, a full-width danger action and the corner X; the X dismisses it; no
"connection active" text remains anywhere on the page; gap measures 32px.
**Not exercised: confirming the log out** — that ends the session, and nothing
in the request asked for it. Gates: tsc clean, eslint clean on the touched
files, 126/126 tests.

## 2026-08-27 — Profile pictures

**This branch now owns the schema slot** (`.worktree` SCHEMA=none → owned; it
was free, `post-time` doesn't hold it). Migration `create_avatars_bucket`
applied to the live remote project.

**The bucket is public-read, unlike the other two.** writing-style-files and
content-reference-files are private with signed URLs; an avatar renders in the
navbar on every page, and minting a signed URL per render for something that
isn't secret is cost with no benefit. Paths are uuid-based so they aren't
guessable, but they are not access-controlled — that was the explicit choice.
Writes stay owner-scoped exactly as the other buckets do (first path segment
must equal `auth.uid()`), and the bucket carries its own 5MB limit and MIME
allow-list so a bypassed client check still can't land a bad file.

- **The upload goes browser → Storage directly, never through a Server
  Action.** Next caps a Server Action body at exactly 1MB — the ceiling that
  bit the writing-style uploads (see the note further up this file) — and most
  photos off a phone exceed it. The Supabase JS client talks to the Storage
  endpoint itself, so that limit never applies.
- The resulting URL is saved to **auth `user_metadata.avatar_url`**, not a
  table: it belongs to the person, not a project, and it already rides along on
  the session every page reads. No second query anywhere.
- Replacing a picture best-effort deletes the old object, so the bucket doesn't
  accumulate every picture a user has ever had. A failure there is deliberately
  silent — the new avatar is already saved, and an orphan isn't the user's
  problem.
- **Centred in the circle** is `object-cover object-center` on a fixed square
  box: the image fills the frame and is cropped evenly rather than squashed.
  Verified with a deliberately wide 400×200 test image — the centre marker
  landed dead centre with equal slivers either side.

**Default avatars are now randomised, deterministically.**
`components/shared/gradient-avatar.tsx` inlines the Figma avatar SVG so its
three blurred blobs take colours as props, with six palettes (the first is the
export's own colours exactly). `avatarPaletteFor(seed)` is FNV-1a over the
user's uuid, `% palettes.length`.

The important part is that it is **not random**: `Math.random()` would give a
different avatar on every render, so the server render and hydration would
disagree (a mismatch) and the picture would change on every navigation. Hashing
a stable id gives one user one gradient, on every device, forever — with
nothing stored and no schema involved. Two footguns handled in the code: the
`>>> 0` (JS bitwise ops are signed, so a hash with the top bit set yields a
negative index) and `useId()`-namespaced filter ids (the export's ids are fixed
strings, and two avatars on one page would otherwise define them twice).

`components/shared/user-avatar.tsx` is the read-only pairing of the two
(picture if there is one, else the hashed gradient), now used by the navbar
chip and the create-project greeting. `connected-account-row.tsx` still uses
the flat SVG deliberately — that one is a *social account's* photo with the
gradient as its fallback, a different subject entirely.

Verified in-browser on :3002: this user hashes to the blue palette, and the
profile header and navbar chip agree; a real upload persisted across a
navigation and rendered centred at both 40px and 28px. **Then reverted** — the
test image was deleted from Storage and `avatar_url` cleared, since it was a
test, not a picture anyone chose. Bucket is back to 0 objects.

**Gap worth naming: there is no way to remove a picture.** Once uploaded, a
user can only replace it, never go back to their gradient — reverting my own
test needed SQL and a raw Storage call. The export doesn't draw that control,
so it wasn't invented; flagged rather than built. Also note direct
`delete from storage.objects` is blocked by Supabase (`protect_delete`) — the
Storage API is the only way, which is worth knowing for any future cleanup.

Gates: tsc clean, 126/126 tests, eslint 17 errors — all pre-existing (same
files as before; none new).

### Same day — 12 palettes, bigger avatar, live navbar update

1. **Twelve palettes, not six.** The original six stay (only palette 0 is the
   export's; the other five were invented — see the note in
   gradient-avatar.tsx), and six more are built from the token ramps in
   app/globals.css: flame / amber / green / lime / purple / red at
   {200,400,600}, which mirrors the export's own light → saturated → deep
   structure. Those six need no colour exception at all. The hexes are written
   literally rather than through `var()` — they're SVG `fill` attributes on
   filtered shapes and the array is also indexed in plain JS — so they're a
   hand-synced pair with globals.css, same arrangement as EDGE_FADE_PX.
2. **Profile avatar 40 → 56px** (+16), per request. Confirmed 56×56 in-browser.
3. **The navbar chip now updates without a reload.** `lib/avatar-store.ts` +
   `hooks/use-avatar-url.ts`, the same module-store shape as generation-lock /
   network-status / section-navigation, and for the same reason: every avatar
   renders from a *server* component reading `user_metadata`, while the writer
   (the picker) sits below them in the tree — so a server render was the only
   thing that could ever refresh them. `UserAvatar` became a client leaf so it
   can subscribe; `null` override means "fall back to the server value", which
   stays authoritative on every fresh load and navigation.

**Verified in-browser, and this one needed care.** By the time I tested, the
user had uploaded a real 4.5MB JPEG of their own — so testing the fix meant
uploading over it, and the picker deletes the previous file on replace. Copied
their object to a backup key via the Storage API first, ran the test (the chip
updated to the test image with **no reload** — the reported bug, fixed), then
restored the original from the backup, deleted both the test file and the
backup, and put `avatar_url` back to its original value. Bucket ends with
exactly their one object at its original path; their picture renders unchanged.

Incidental confirmation from that upload: 4.5MB went through fine, which is the
browser → Storage path doing its job — it would have been rejected outright by
a Server Action's 1MB body cap.

Two notes for anyone testing uploads here: `file_upload` populated the input
but React's `onChange` didn't always fire, so the handler needed a manual
`dispatchEvent(new Event('change', {bubbles:true}))`; and direct
`delete from storage.objects` is blocked by Supabase's `protect_delete` — the
Storage API is the only route.

Gates: tsc clean, 126/126 tests, eslint 17 errors — all pre-existing.

### Same day — uploads are compressed in the browser

They weren't before: a 4.5MB photo was stored at 4.5MB and re-fetched at that
size on every page render, for something drawn at 56px.

`lib/compress-image.ts` resizes to fit 512px and re-encodes as WebP at q80 —
the same quality the Figma bridge already uses for raster assets. No package
added; `createImageBitmap` + canvas + `toBlob` are built in. 512 is chosen off
the render size: 56px on Profile, 28px in the chip, so even at a 3× DPR that's
168px, and 512 leaves room for a larger frame later.

Three details that matter:

- **EXIF orientation is honoured** via `createImageBitmap(file, {
  imageOrientation: "from-image" })`. Phone photos routinely carry a rotation
  flag rather than rotated pixels; drawing one to a canvas without this bakes
  in the *unrotated* pixels, so a portrait selfie uploads sideways.
- **An animated GIF becomes a still** — a canvas only ever sees one frame.
  There's no way around that on this path; the first frame is what's stored.
- **The stored extension comes from the output, not the input** (`.webp`
  always). Storing WebP bytes under a `.png` name makes every consumer guess.

The size check moved from 5MB to a deliberately generous 25MB and now guards
the *decode* rather than the upload — nothing near that is ever stored, so
picking a 12MB photo just works. The bucket's own 5MB limit remains the
backstop on what actually lands.

**Verified end-to-end with a deliberately hostile input**: a 1800×1200 PNG of
pure random noise, 6.18MB, which is about the least compressible thing there
is. Stored result: **68.3KB WebP — a 93× reduction**, and a real photo will do
better still. The navbar chip updated live during the same upload, so that fix
held too.

Same care as last time around the user's own avatar: they had uploaded a new
76KB PNG since, so it was copied to a backup key first, the test run, then the
original restored to its exact path and both the test file and the backup
deleted. Bucket ends with exactly their one object at its original URL,
rendering unchanged. (Their PNG predates this change, so it is still stored
uncompressed — only new uploads go through the compressor.)

Note for future testing here: the Storage access token pulled out of the cookie
expires within the session, and every call then returns a 400 whose body is a
404 `NoSuchKey`-style error rather than anything auth-shaped. Re-read the
cookie and retry before concluding an object is missing.

Gates: tsc clean, 126/126 tests, eslint 17 errors — all pre-existing.

## 2026-08-28 — Password toast position + auto-collapse

**The toast appeared to come out of the password field**, not down from the top
of the screen. Cause was a trap already written up in LEARNINGS: a `clip-path`
makes the element the containing block for its `fixed` descendants *and* crops
them, and `ProfileDisclosure`'s card carries the squircle clip. So the toast —
`fixed inset-x-0 top-pad-2xl`, correct in itself — was being positioned and
clipped to the card. My mistake when writing the panel; the entry existed.

`components/shared/toast-slot.tsx` extracts the fix that day-deck.tsx and
post-details.tsx had each written inline: portal to `<body>`, same fixed
top-centre wrapper. Adopted by change-password-panel, ai-models-panel and
avatar-picker (the last isn't inside a clipped card, but it costs nothing and
keeps the screen consistent). The portal target deliberately isn't gated on
whether a toast is open — the toast's own presence drives its exit animation,
so unmounting the target with it would tear that out mid-exit. LEARNINGS'
clip-path entry now points at the component instead of just describing the fix.

**The panel also collapses itself on success** — `ChangePasswordPanel` takes an
`onSuccess`, and ProfileScreen passes `setPasswordOpen(false)`, so it folds
away on the same 160ms close the header toggle uses. Toast fires first and
lives outside the subtree, so it stays up while the panel closes underneath it.

Verified in-browser: all three toast slots are now direct children of `<body>`,
none inside a clip-path ancestor, measured at top 32px across the full
viewport; a real (avatar) error toast rendered its text inside that body-level
slot. **Not verified: the success path itself** — that needs a real password
change, which isn't mine to make. The collapse is wired to the same state the
header toggle sets, whose animation was verified when the disclosure was built.

Gates: tsc clean, 126/126 tests, eslint 17 — all pre-existing.

### Same day — password errors land on the field they're about

"That's not your current password." was marking *both* fields invalid and
printing under the new one, which is the wrong field twice over.

Rather than just moving it, the action now names the field it belongs to —
`ChangePasswordError = ActionError & { field?: "current" | "new" }` — because
the failures genuinely belong to different inputs:

- `"That's not your current password."` → **current**
- `"New password must be at least 8 characters."` → new
- `"That's already your password."` → new
- whatever `updateUser` objects to → new (the current one has already been
  accepted by that point)
- signed-out → no field; the panel falls back to the new-password slot

The panel holds `{ message, field }` instead of a bare string, and each
`PillInput` takes its `aria-invalid` and `helperText` only when the error is
its own — so nothing marks a field the error isn't about.

Also renamed the reveal button's label and the comment above it from "old
password" to "current password", matching the field label as it now reads.

Verified in-browser by submitting a deliberately wrong current password (a
string that is nobody's credential, and which fails at the re-auth step before
`updateUser` is ever reached, so nothing could change): the danger border,
warning icon and message all appear on the current-password field, and the new
password field stays in its resting state.

Gates: tsc clean, eslint clean on the touched files.

### Same day — no tick on the "Password changed" toast

`showIcon={false}` on that one Toast. The icon `<span>` is conditionally
rendered as a whole and the pill's `gap-dist-sm` sits *between* flex children,
so removing it leaves no stray gap — the toast becomes a correctly-padded
text-only pill. First `showIcon={false}` in the app; every other toast keeps
its variant icon.

Verified by reading toast.tsx's layout rather than in-browser: firing this
toast needs a real password change, which isn't mine to make (same limit noted
when the panel was built). Gates: tsc clean, eslint clean.

### Same day — shorter length-error copy

"New password must be at least 8 characters." → **"Must be at least 8
characters."** It renders directly under the field it's about (since errors
started routing to their own field), so naming the field there said the same
thing twice.

Scoped to Profile only. The signup and forgot-password flows keep their own
wording — those sit under a lone password field with no second one to
distinguish from, so "Password must be…" still reads correctly there.

Verified in-browser: a 5-character new password marks only the new field and
prints the new copy; the current-password field stays in its resting state.
Gates: tsc clean, eslint clean on the touched file.

### Same day — bug: "That's already your password." on a password that wasn't

**Reported and reproduced:** typing the *same wrong string* into both fields
reported "That's already your password." The sameness check ran before the
current password had been verified, so it was asserting something the action
had never checked — the two fields matched each other, which says nothing about
what the account's password actually is.

Validation is now explicitly ordered, per the requested sequence:

1. **New password length** — the only rule judgeable without the auth server,
   so nothing is spent before it.
2. *(defensive)* empty current password → its own message rather than falling
   through to the re-auth call and coming back as "not your current password",
   which would be true and useless. Unreachable through the UI, which disables
   submit until both fields have content.
3. **Verify the current password** via re-auth → wrong ⇒ "That's not your
   current password." on the **current** field.
4. **Only then compare the two** → equal ⇒ **"Passwords must be different."**
   on the **new** field. By this point the current password is known correct,
   so equality genuinely does mean the new one is unchanged.
5. Update.

The zod schema is shape-only now (`z.string()` for both). The length and
sameness rules moved into the body deliberately: **their order is part of the
contract**, and a schema collapses every rule into one undifferentiated parse
failure with no way to say which field or which reason.

Copy note: written as "Passwords must be different." with a full stop, to match
its siblings ("That's not your current password.", "Must be at least 8
characters.") — the request wrote it without one.

Verified in-browser by reproducing the exact report — the same wrong string in
both fields now correctly returns "That's not your current password." on the
current field, and the new field stays in its resting state. The "Passwords
must be different." path can only be reached with a genuinely correct current
password, so it remains unexercised, along with the success path.

Gates: tsc clean, eslint clean on the touched file.

## 2026-08-28 — Pick a gradient (design-sync/profilescreenpickprofile)

**The export's 24 swatches are only 6 distinct gradients** — the other 18 are
the default `sunset` repeated, i.e. placeholder fill (verified by diffing the
fills across all 24 exported SVGs). Rather than render 19 identical circles,
the popover maps the real list and lets the row wrap, so the grid grows with
the list instead of being pinned to a 5×5 that can't be filled honestly.
**17 distinct gradients today**: the export's 6, the 5 hand-picked ones kept by
request, and the 6 token-derived.

- `AVATAR_PALETTES` became `AVATAR_GRADIENTS`, each entry carrying a **stable
  id** (`sunset`, `lagoon`, `flame`, …). **The stored pick is that id, never an
  array index** — an index would silently reassign everyone's avatar the moment
  the list is reordered or something is inserted mid-way. `gradientById()` is
  the lookup; an unknown id falls back to the hashed default, so a removed
  gradient degrades instead of crashing.
- `components/profile/avatar-gradient-popover.tsx` — Base UI Popover (already a
  dependency, no package added), dark `surface-inverse` card, the export's
  pointer (the same single rotated path tooltip.tsx uses), a dashed "+" upload
  cell, then the swatches. Grows out of the anchor at 150ms on the app's strong
  ease-out, per STANDARDS.md's 125–200ms popover band, from scale-95 never 0.
- The avatar is now the popover's **trigger** rather than a direct file-dialog
  button; uploading is one option among the gradients instead of the only one.
- **Picking a gradient clears the photo and deletes the file** — a photo
  outranks a gradient, so leaving it behind would make the choice look ignored.
  Optimistic per AGENTS.md, reverting both fields on failure. Note this is
  irreversible: there's no photo history in the design.
- `lib/avatar-store.ts` gained a second channel plus an explicit
  `photoCleared` flag — a `null` photo override can't otherwise be told from
  "this tab never touched it", which would let the server's stale photo win and
  make the pick look ignored. `useAvatarUrl` → `useAvatarDisplay`, returning
  both. `gradientId` is threaded through every avatar site (navbar, topbar,
  layout, /projects, /create-project).

**On the database cost — measured, not estimated.** The pick is one key in
`auth.users.raw_user_meta_data`, the JSONB the session already carries and
every `getUser()` already returns. After picking, the *entire* metadata blob
for this user — name, gradient, everything — was **179 bytes**
(`pg_column_size`). No new table, no new query, no migration, no extra
round-trip. A gradient is also *cheaper than a photo*: no Storage object and no
CDN fetch, since it renders as inline SVG.

Verified in-browser: the popover matches the export, all 17 swatches render
distinctly, picking one switched the avatar and the navbar chip instantly with
no reload, and the DB showed `avatar_gradient: "azure"` with `avatar_url: null`
and the old file removed. **Then restored** — the user's photo was copied to a
backup key first (it had changed again since the last round, now a compressed
`.webp`, so the compression path is in real use), and afterwards put back at
its exact path with `avatar_gradient` cleared. Bucket ends with exactly their
one object.

Testing note: the Supabase auth cookie is **chunked** across
`sb-…-auth-token.0` and `.1` once it grows past a size limit. Reading only
chunk 0 yields a truncated JWT and every Storage call fails with
`Invalid Compact JWS`. Sort the chunks by their numeric suffix, join, *then*
strip the `base64-` prefix and decode.

Gates: tsc clean, eslint 17 (all pre-existing), 126/126 tests.

### Same day — five fixes on the gradient popover

1. **Hover icon is a pencil, not a camera** (`PencilSimple`) — the avatar can
   now be a gradient as well as a photo, so a camera named the wrong action.
2. **The tip was hidden on open.** Base UI places the arrow at the popup's own
   top edge, which for a bottom-side popover is *behind* the card. Two changes:
   `sideOffset` now reserves the export's 12px Pointer height, and the arrow
   gets `-translate-y-full` to lift it by its own height into that gap.
   Tailwind's `translate-*` sets the standalone `translate` property, so it
   can't collide with the `scale` the transition animates. Verified: arrow top
   530 against the card's 541.
3. **Bounce + easing, wired to DialKit** ("Profile image popover", explicit id
   per AGENTS.md). Enter: duration / scale / bounce / fade; exit: duration /
   scale. The bounce is real overshoot, not an approximation: `lib/spring-
   easing.ts` samples a damped spring into a CSS `linear()` string —
   **`linear()` sets progress point by point, so a spring's trajectory can be
   baked into a plain CSS transition**, which is the only kind Base UI's own
   mount/unmount can drive. `bounce: 0` short-circuits to the app's strong
   ease-out rather than approximating one in 24 stops. Opacity stays on its own
   shorter ease-out tween and never rides the bounce — an overshooting fade
   passes 1, clamps, and reads as a flicker (toast.tsx makes the same call).
4. **The tip no longer outlives the card.** It had no transition at all, so on
   close the card faded over its duration while the arrow stayed fully opaque
   until unmount. Both now carry the identical transition — verified in-browser
   as byte-identical `transition-duration` *and* `transition-timing-function`
   on the two elements.
5. **The upload cell is drawn as SVG, not `border-dashed`.** CSS gives no
   control over dash length, gap, or cap shape. A `<circle>` with
   `stroke-dasharray="0.5 7"` and `stroke-linecap="round"` in `--border-bold`
   gives round-capped dots with a wide gap; the plus is two round-capped
   strokes in `--icon-minimal`, matching. Round caps extend each dash by half
   the stroke width at both ends, which is why the dash is short and the gap
   generous — otherwise they merge back into a solid ring.

**The find that cost the most time, worth knowing:** `Popover.Popup` ignores
the `style` prop — Base UI writes its own `style` attribute straight to the
DOM, outside React. Measured directly: the arrow (a plain element) picked up an
inline duration while the popup silently fell back to Tailwind's 150ms default.
dialog.tsx already documents this for `Dialog.Popup`; it holds for Popover too.
Fix is CSS variables set on the *positioner*, which inherit down to both parts
and nothing overwrites. Added to LEARNINGS.

Second gotcha, already in AGENTS.md but hit again here: measuring the popup
through `javascript_tool` shows `transition: none` with `data-starting-style`
still attached, because Base UI applies the starting style with transitions
disabled and clears both on the next frame — and an eval backgrounds the tab,
so that frame never arrives. Foreground with `computer` first, *then* measure.

Gates: tsc clean, eslint 17 (all pre-existing), 126/126 tests.

### Same day — the popover was snapping: my regression, plus the missing shadow

**Reported: "it still snaps and nothing changes it on DialKit." Correct, and it
was a regression I introduced.**

When I moved the transition values from the `style` prop onto CSS variables
(because Base UI clobbers `style` on Popup), I also rewrote the from-state as a
React ternary — `open ? "scale-100 opacity-100" : "opacity-0 …"`. That looks
equivalent and is not: **by the time the element mounts, `open` is already
true**, so it renders at its final scale with nothing to transition *from*. It
snapped, and with no transition running every dial appeared dead.

The from-state has to come from Base UI's own `data-starting-style` /
`data-ending-style` attributes — the element mounts carrying the starting one,
Base UI clears it a frame later, and the transition runs between the two. This
is the pattern dialog.tsx already uses; my first version of this file had it and
the rewrite dropped it.

**How I got it wrong, worth recording:** I "verified" by reading computed styles
in the *settled* state and finding the duration and easing correct on both
parts. That only proves the transition is *declared*, never that it *ran* — and
I had already written in this log that mid-flight sampling isn't possible
through `javascript_tool`. Declared ≠ running. This time it was verified by
catching the popover mid-animation in a screenshot: visibly smaller than its
settled 262px and semi-transparent, with the page showing through it.

**Shadow added, from the export I'd missed.** frame.json carries a `DROP_SHADOW`
on the Tooltip frame — radius 8, offset 0,0, `#1919193d` (25,25,25 at 24%) — and
the first pass never read the effects. It's a `drop-shadow` filter on the Popup,
i.e. *outside* the squircle-clipped card, per LEARNINGS' "a clip-path cuts the
element's own drop-shadow"; the shadow traces the clipped silhouette. Applied to
the arrow too, so the tip and card read as one object.

**Where to tweak it:** the DialKit panel, "Profile image popover" → **Shadow**
folder — Blur (0–48), Y (−12–24), Opacity (0–0.8). Alongside Enter
(duration/scale/bounce/fade) and Exit (duration/scale). All six now visibly
respond, since the transition actually runs.

Gates: tsc clean, eslint 17 (all pre-existing), 125/125 excluding the
quota-blocked live-Gemini test (see FOLLOWUPS).

### Same day — the tip detaching during the animation

**Reported: the tip looks detached while the animation runs, and lingers for a
split second on close.** My previous "fix" gave the arrow the *same* transition
as the card, which is not the same as making them move together.

Cause: they were two separate elements, each scaling around its **own**
transform-origin — the card around the anchor's, the tip around its own centre.
Identical duration and easing don't help when the geometry differs: they travel
at different rates in screen space, so the tip visibly separates and re-seats.

Fix: **`Popover.Arrow` is gone**; the tip is drawn inside `Popover.Popup`,
absolutely positioned at top-centre, so it belongs to the same scaled subtree as
the card. Detaching is now geometrically impossible rather than merely
synchronised. Safe to hand-place because this popover's `side`/`align` are fixed
(`bottom`/`center`) — collision-aware repositioning was the only thing the Arrow
part was buying, and nothing here needs it. The tip sits outside the clipped
card (a clip-path would cut it) but inside the Popup, so the single
`drop-shadow` filter now traces card *and* tip as one silhouette instead of
outlining each separately.

Verified: `tipInsidePopup: true`, exactly **one** element carrying a transition,
zero separate arrow elements, and the tip's own wrapper at `transition-duration:
0s` — it rides the popup rather than animating itself. Also caught mid-flight in
a screenshot with the exit duration temporarily dialled to 400ms: the card
part-faded and part-scaled with the tip still seated on its edge.

Note the DialKit values are **not persisted** — no localStorage keys — so the
400ms used for that test reverted to the code default on reload.

**The lesson, added to LEARNINGS:** giving two elements identical transitions
does not make them move as one. Only a shared transform parent does.

Gates: tsc clean, eslint 17 (all pre-existing), 125/125 excluding the
quota-blocked live-Gemini test.

### Same day — popover motion values frozen

The dialled-in values, now the defaults in the `useDialKit` call (same
treatment as toast.tsx's entrance and the day deck's fan — these are what was
tuned on the panel, not theoretical starting points):

| | | |
| --- | --- | --- |
| enter | duration 320 · scale 0.8 · bounce 0.25 · fade 200 | |
| exit | duration 200 · scale 0.7 | |
| shadow | blur 16 · y 2 · opacity 0.4 | |

Three notes on why these read the way they do:

- **fade 200 finishes before the 320ms scale**, so the card is solid while the
  bounce is still settling — which is what keeps a bouncing entrance from
  looking like a flicker.
- **exit collapses further than the entrance grew from** (0.7 vs 0.8). Not
  symmetry for its own sake: going smaller on the way out reads as being put
  away rather than merely reversed.
- **The shadow is deliberately heavier than the export**, which specifies
  radius 8 at 24%. Against the real dark card on the real canvas that all but
  disappeared; 16px at 40%, nudged 2px down, is what actually reads.

The dials stay wired, so all nine remain adjustable on the panel.

Verified from a fresh load: the panel shows all nine values, confirming they
come from the code rather than an in-memory override, and the entrance was
caught mid-flight — part-scaled and part-faded with the tip seated on the
card's edge.

Gates: tsc clean, eslint 17 (all pre-existing), 125/125 excluding the
quota-blocked live-Gemini test.

## 2026-08-28 — Editable name, email in the header, member-since moved

Four changes, by request.

1. **The navbar chip truncates.** `max-w-40` + `truncate`, and `min-w-0` —
   which is the part that actually does the work, since a flex child won't
   shrink below its content width without it.
2. **The name is edited in place.** Hovering reveals a pencil; clicking swaps
   the heading for a borderless input styled with the identical type classes,
   so the only thing that visibly changes is the caret. **The caret lands at
   the end rather than selecting the name** — the common case is fixing or
   appending a character, not retyping. Enter blurs (so the blur handler stays
   the single commit path and Enter can't double-save), Escape reverts. Focus
   and caret placement happen in a **callback ref**, not an effect: the input
   only exists once editing starts, so the ref fires exactly when the node
   attaches, which is also the only moment `setSelectionRange` can work.
3. **"Member since …" moved below Replay onboarding**, where it reads as a
   footnote to the account rather than a caption on the person.
4. **The email takes its place under the name**, deliberately not editable —
   changing the address on an account is a verified flow of its own, not an
   inline edit.

`updateDisplayName` is back in account-actions.ts (it was deleted when the
first export dropped the name field). It revalidates the **layout** segment,
not just the page: the navbar chip renders from the layout's own `getUser()`,
so a page-only revalidate would leave the chip on the old name.

Verified in-browser end to end: pencil on hover; clicking gives
`caretStart/End = 6/6` on "Godwin" with nothing selected; renaming to a
23-character single word truncated to "BARTHOLOME…" in the chip (still inside
the navbar) and "BARTHOLOMEWQUIXO…" in the heading (still inside the 272px
column), and the chip updated from the server, which also confirms the layout
revalidation. **Name then restored to "Godwin"** — verified in the DB.

Gates: tsc clean, eslint 17 (all pre-existing), 125/125 excluding the
quota-blocked live-Gemini test.

### Same day — name centring, DialKit removed, member-since spacing

1. **The name was off-centre in display mode.** `opacity-0` hides an element
   but still reserves its width, so the hidden pencil — a flex sibling — was
   pushing the name left by half the icon-plus-gap. That's also why it looked
   correct the moment you clicked: editing swaps in an input with no icon
   beside it. The pencil is now absolutely positioned against the text's own
   box (`left-full`, out of flow), so it contributes nothing to centring at any
   name length. Verified: name, email and button centres all land on 1168.
2. **DialKit is gone from this page** — values frozen as `ENTER` / `EXIT` /
   `SHADOW` constants, exactly what was dialled in, same treatment as
   toast.tsx and use-shake.ts. `ENTER_EASING` is computed once at module level
   now that the bounce is a constant. **No `useDialKit` call remains anywhere
   in the app.** `DialRoot` stays mounted in app/layout.tsx — it's the panel
   host, harmless with nothing registered, and removing it would mean putting
   it back for the next thing that needs tuning.
3. **"Member since …" gained clearance** — `mt-dist-md` on top of the column's
   own `dist-md`, so 16px instead of 8. Measured in-browser. It now separates
   from the menu rather than reading as a fourth row that lost its card.

Gates: tsc clean, eslint 17 (all pre-existing), 125/125 excluding the
quota-blocked live-Gemini test.
