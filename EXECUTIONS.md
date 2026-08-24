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
