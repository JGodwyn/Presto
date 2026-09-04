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

## 2026-08-27 — feat/post-time: the Generate page's dates section gets a time

Two new Figma exports (`design-sync/calendar-with-time-daily`,
`calendar-with-time-monthly`) put a time-of-day row on the calendar-based
Generate page, and re-cut the Monthly card while they were at it. Built both,
plus the plumbing that makes the picked time reach the database.

**Read first.** The map that preceded this: `posts.scheduled_for` is already
`timestamptz`, so no migration — the column has always been able to hold a
time, and every writer just pinned it to local midnight. Three places do that
pinning: `components/ui/calendar.tsx:86`'s `setHours(0,0,0,0)` (shared by all
three date pickers) and GenerateCard's two date walks. This branch changes the
second of those; the pickers on a post card still pin midnight, which is the
remaining wave.

**`lib/time-of-day.ts` + test.** The value (`TimeOfDay` = hour 1-12, minute,
AM/PM) and its math, kept out of the declared-hot `lib/format-date.ts`. The
12 AM/12 PM pair is the whole reason `to24Hour` isn't a one-liner, and the
test walks every hour of the day through the round trip. `atTimeOfDay` stamps
a time onto a calendar day through the local `Date` constructor rather than by
adding milliseconds — across a DST boundary the offset between two days isn't
a constant number of hours, and the day the user picked is what has to
survive.

**`components/ui/time-field.tsx`.** The row itself, identical in both exports
(surface-2 tray, three 48×40 surface-4 segments, flanking 16px marks).
Measured against the export in-browser: row 48, tray 177×48 (the 1px is the
":" glyph), segments 48×40, tray/mark fills `#e7dfdc`, padding 4, gap 4 —
matching. Hour and minute are `type="text"` + `inputMode="numeric"` rather
than `type="number"` (no spinners, no "e", no unbounded length), digits
filtered on the way in; arrows step and wrap; AM/PM is a one-tap toggle, per
direct request, since two options don't earn a dropdown.

**`Calendar` gained a `footer` slot**, rendered in day view only — the month
and year pickers replace the grid wholesale, and a time sitting under a list
of years reads as belonging to the list. Verified: opening the month picker
hides the row.

**`MonthGrid` re-cut** to the new export: year nav and month pills both
centred (they were left-aligned), a `DottedDivider` and the time row inside
the card, and an info marker absolutely positioned 8px in from the card's top
and right with the export's tooltip copy — which replaces the "Select months
to generate for" line that used to sit above the card. Tooltip measured
against the export: 264×56, `#050302` on `#fffffe`, 14/20, 8px/12px padding,
12px radius, centred — exact.

**Plumbing.** `postTime` lives on GenerateCard beside the dates, persists to
`localStorage` as a 24-hour `"HH:MM"` (round-trippable and timezone-free,
unlike the `"YYYY-MM-DD"` dates beside it which have to dodge UTC day-shift),
resets with the calendar, and is stamped onto every date `scheduledDates`
produces.

**One bug caught in the writing, not in testing:** the date-range walk
compared its cursor against `dailyRange.to` directly. `to` is local midnight,
so a cursor carrying an evening time would overshoot it and silently drop the
last day of the range. The comparison is now against `to`'s calendar day. See
LEARNINGS.

**Verified end-to-end without generating anything.** Patched
`Storage.prototype.setItem` to capture the `presto:generate:scheduled-dates`
handoff and throw before `router.push`, so no run ever started: three picked
dates came out as `2026-08-10T18:03:00.000Z` etc. — 19:03 local, the time in
the field — where they would previously have been local midnight. Page stayed
on `/generate`, no posts created. Also verified the value survives a reload,
and that the panel's reset button returns it to 9:00 AM.

Gates: tsc clean, eslint clean on every file touched (generate-calendar-
column.tsx's 10 `react-hooks/refs` errors are pre-existing — confirmed
identical count against `HEAD` via `--stdin`), 139/139 tests.

### Same day — the re-export, and the time inside both post pickers

**The re-exported daily calendar** (`design-sync/calendar-with-time-daily`,
18:02) groups the title bar and day grid in a gap-0 wrapper and gives the card
itself `dist-lg`, so the time row now sits behind the same dotted divider the
monthly card has, with 16px either side of it. Carried in `Calendar` rather
than by the card's own gap (its children are gap-0 and every other one — the
month list, the year list, the action bar — has to stay that way). Verified in
the live DOM: 16 above, 16 below, row 48, card 320 wide.

`DottedDivider` stays in `components/instructions/` rather than moving to
`components/ui/`: `feat/settings-profile` is live and imports it, so a move
would hand that branch a conflict on its import line for no benefit. Four
files outside `instructions/` already import it from there.

**Both post pickers now carry the time**, via a new shared
`components/shared/date-time-picker-dialog.tsx`. The generated-post card and
the post-details page were rendering byte-identical dialogs; now that there's
behaviour inside one, keeping two copies in step was not an option. Both call
sites lost their `Calendar`/`Dialog` imports and their long duplicated comment
blocks along with it.

**The commit story is the interesting part**, because the two halves of the
picker aren't the same kind of control:

- A **date click** commits and closes, exactly as before — it just carries
  whatever time is showing.
- The **time writes through on its own**, for a post that already has a day to
  attach it to. A draft has none, so its time is held and rides along with
  whichever date gets picked.
- **Debounced 300ms**, because typing "1" then "2" for 12 (or holding an arrow
  key) is several changes in a few hundred ms, each of which would otherwise
  be its own fire-and-forget update of the same row — the out-of-order hazard
  AGENTS.md ships `useSaveQueue` for. One trailing write per burst removes it
  without a queue, since only one request is ever in flight. Flushed on
  unmount so a fast close doesn't drop the last edit, and cancelled by a date
  click, which supersedes it (letting the older write land afterwards would
  put the post back on its previous day).
- Cancel is therefore not a discard. It never was — it closes without picking
  a date, and Escape and outside-click do the same.

The body is a separate component mounted inside `DialogContent`, so Base UI's
lazy portal re-seeds the time from the post on every open instead of keeping
the last session's value.

**Verified against the live DB**, on a real post
(`f87960e2…`, `2026-08-28 09:00+00` = 10:00 local):
opened the post-details picker → seeded 10:00 AM; switched to PM and typed 45
→ row read `2026-08-28 21:45+00`, day unchanged; clicked the 20th → `2026-08-20
21:45+00`, **time preserved across a date change** where it would previously
have reset to midnight. Restored the row to its original value afterwards.
The day-deck card's picker opened on a pre-feature post and correctly showed
12:00 AM — the 12 AM/12 PM pair reading back right on a real midnight row.

Gates: tsc clean, eslint clean on all eight files touched, 139/139 tests.

**Still not done, and worth saying plainly:** nothing *displays* the time yet.
A user can set it in either picker and see it there on reopening, but the
post-details heading, the card headers and the dashboard's Next-up line are
all still date-only, so a time change has no on-page confirmation. That's the
display wave from the original map, unchanged.

### Same day — the time on screen, and the Content page sorted by it

**One formatter, `formatClockTime` (lib/time-of-day.ts).** "10:45 PM", and
**"9 AM" on the hour** — the minutes are dropped when they're zero. That isn't
only how the time is said out loud; it's what made it fit. Measured live: a
Kanban card's metadata row has 196px, and "12:00 AM" (65px) beside the account
pill (128px) overran it before the topics were even reached. The compact form
is 40px and leaves the pill whole with a chip edge showing under the row's
existing fade — which is that row's designed "there's more" state. Most posts
land on the hour anyway, since a batch picks one time for every date.

**Four surfaces, each fitted to its own layout rather than one treatment
forced onto all of them:**

- **`generated-post-card.tsx`** (Generating page *and* the day deck) — date
  over time in the header, a stacked pair. One line was tried on paper and
  fails at the deck's 272px: "Sept 15th, 2026 · 10 AM" only fits by
  truncating, and half a date is worse than a second line. The stack also
  leaves the actions button exactly where it was.
- **`kanban-post-card.tsx`** — the time *leads* the account/topics row. This
  is the one card that shows no date at all (its column header names the day),
  so a bare time is unambiguous, and putting it first lines it up down the
  column, which is now what the column is sorted by. Deliberately not its own
  line: the board is 400px and was raised there specifically to fit three
  cards, which a fourth row per card would undo (2.3 cards instead of ~3).
- **`post-details.tsx`** — a Clock + time line under the heading, bound to it
  at `dist-sm` against the column's own `dist-lg`. Not part of the `<h1>`:
  "AUGUST 28TH, 2026 · 10 AM" in Phudu at heading-sm wraps in this 400px
  column anyway, and two lines of display caps is far heavier than one line
  plus a quiet second. Hidden mid-regenerate along with the date it belongs to.
- **`dashboard-post-card.tsx`** — `August 28, 2026 • 12 AM • Tomorrow`, all
  three on one row. A first pass moved the relative day to its own line on the
  assumption three segments wouldn't fit; measuring showed this card runs the
  width of the Next-up column, the widest thing on the dashboard, so the extra
  line was reverted.

Day chips and Kanban column headers deliberately get nothing: both cover a
whole day.

**Sorting (`lib/content-grouping.ts`).** `byNewestFirst` became `comparePosts`:
within a day, posts now sort by the scheduled moment in the same direction the
days around them read — Queued forwards (the next one out on top, as across
days), Published backwards. The old comment had already named the reason this
couldn't be done before ("posts generated into the same day usually share a
time"); that is still true of a batch, which is why creation order is kept as
the **tiebreak** rather than dropped. Draft has no scheduled time by
definition, so it falls straight through to that tiebreak and reads
newest-written first exactly as it did. Four cases pinned in
lib/content-grouping.test.ts.

Verified in-browser on real data: 28 August's two posts (12 AM, 10 AM) read in
that order on Kanban, in the day deck, and in the dashboard's Next-up list —
they were the other way round before, ordered by when they were written.

Gates: tsc clean, eslint clean, 145/145 tests (6 new).

### Same day — three corrections on the time's presentation

**The ordinal is gone from the full-date formats**, per direct request:
`formatFullDate` is "July 5, 2026" and `formatShortDate` "Sept 5, 2026".
`formatOrdinal` itself stays, and so do its two remaining callers — the
Content day chips ("28th") and a Kanban column header ("28th August"). That
split is deliberate rather than an oversight: a bare day is read as "the
28th", while a date that already names its month and year reads as "August 28,
2026". Say the word if the chips should follow.

**The post card's time moved back beside the date** rather than under it, in
the same `body-lg-bold`, separated only by `text-subtle` and a `dist-sm` gap —
no middot needed when the colour already does the work.

It does not always fit, and the numbers are worth recording. The day deck's
card is 272px, which leaves its header 232px: icon 20 + gap 4 + date 104 +
gap 4 + time + button 40. An on-the-hour time ("10 AM", 48px) fits with room
to spare; a to-the-minute one ("4:32 PM", 64px) is **4px over**. So the date
truncates, per the same request — it's the half that can lose its tail and
still say what it is, where a clipped "4:32 P…" says nothing. The Generating
page's card is wider and shows both in full. Four pixels is close enough that
shrinking the header's CalendarDots from `size-5` to `size-4` would close it;
not done, since that size came off the export and buying 4px isn't reason
enough to change it unasked.

**Post details' time line**: Clock → `Timer` at `weight="fill"`, `size-4`
(from a bold `size-5`), and the label itself from `body-lg` to
`body-lg-bold` — smaller, bolder, both as asked. Checked at render: the fill
weight keeps the needle knocked out white at 16px, so it still reads as a
timer rather than a dot.

Gates: tsc clean, 145/145 tests, and eslint clean on every file this branch
touched — the 24 remaining errors across `components/`/`lib/` are all
pre-existing, confirmed file-by-file against `HEAD` via `--stdin` (identical
counts: switch.tsx 5, generate-calendar-column.tsx 10, and five others).

### Same day — five presentation corrections, all per direct request

1. **`•` between date and time** on the post card, and 2. **the time is plain
   `body-lg`**, not bold — the date keeps the header's weight and the time is
   `text-subtle` beside it, so the pair reads as one line the date leads.
3. **The year is dropped when it is the current one** — `formatFullDate` is
   "August 28" this year and "August 28, 2027" in any other; `formatShortDate`
   the same. This is what finally makes the card header fit: the 4px overrun
   recorded above (the deck's 232px header, "Aug 28, 2026" 104px + "4:32 PM"
   64px) disappears when the date is "Aug 28" at ~56px. Verified live —
   `Aug 28 • 10 AM` and `Aug 28 • 4:32 PM` both sit clear of the button.
   - `now` is a **parameter** (defaulting to `new Date()`) rather than a read
     inside the formatter, following `formatExpiry` and the Content page's own
     `now` prop: a server and the browser hydrating it have to agree on which
     year is current, and they only do if one clock decides. The default is
     for the call sites with no `now` to hand; the window where it could
     disagree is the last minutes of a year.
   - **The dashboard card was formatting its own date** (`toLocaleDateString`
     with `year: "numeric"`), which is why it kept printing the year after the
     shared formatter stopped. Repointed at `formatFullDate` — and it already
     takes `now` as a prop, so it hands over a real clock rather than the
     default.
4. **`gap-dist-md` on the card's header row** so the time never sits flush
   against the DotsThree button — `justify-between` alone left them touching
   the moment the date grew enough to fill the row.
5. **Post details' Timer is outlined again**, `weight="bold"` not `fill`, at
   `size-4` beside the `body-lg-bold` label.

`formatOrdinal` and its two callers (Content day chips, Kanban column headers)
are untouched — a bare day is still "the 28th".

**One place still prints the year and was left alone**: the Generate page's
date-range readout (generate-calendar-column.tsx's own `formatDate`), e.g.
"August 28, 2026 – September 4, 2026". It's a different formatter on a screen
this round didn't cover, and a range reads differently from a single date —
flagged rather than changed.

Gates: tsc clean, eslint clean on every file touched, 149/149 tests (4 new
covering the year rule, in lib/format-date.test.ts).

### 2026-08-28 — the time joins the post-details heading

`AUGUST 28 • 10 AM`, on the heading line itself, in the same `date • time`
shape the post cards read in. The standalone line below the heading is gone,
and so is the icon that led it — the bullet is the separator now, and the date
never had an icon either. The bullet and time are `text-subtle` against the
date's `text-bold`.

It fits at `heading-sm` in this 400px column only because the current year is
dropped (the previous round): "AUGUST 28 • 10 AM" where "AUGUST 28TH, 2026 ·
10:00 AM" wrapped, which is why the time was on its own line to begin with.

**The three parts are separate elements, not one morphed string.** `TextMorph`
takes a plain string, so a bullet and time that need their own colour can't
ride inside the date's. Each half now morphs on its own when the schedule
changes. The `<h1>` became a flex row to hold them.

**Note on the file's state.** post-details.tsx had been edited outside this
session between rounds: the whole file was re-indented (the `git diff` reads
182/177 lines, but `-w` reduces that to 42/37 — the rest is whitespace), the
time line's icon was back to `Clock`/`size-5` rather than the bold `Timer`/
`size-4` from last round, and `ClockAfternoonIcon`, `Timer` and `WatchIcon`
sat imported-but-unused alongside a stray `import { Watch } from
"react-hook-form"` — an auto-import from the wrong package. Built on top of
what was actually there rather than reverting it. All five of those imports
are removed, since the element every one of them was for no longer exists.

**Gates: tsc clean, eslint clean, 148/149 tests.** The one failure is
`lib/ai/generate.test.ts` — a live call to the Gemini API timing out at 30s.
It is unchanged from `HEAD`, imports only `lib/ai/generate` (untouched by this
branch), and passed in every earlier run today, so it is the network or the
API, not this work. Re-running it alone reproduces the same 30s timeout.

### Same day — the month list loses its scrollbar, and ranges keep their years

**1. No scrollbar on the Calendar's month view**, per direct request — the
year list below it keeps one. The two genuinely differ: a year list runs to a
hundred entries with no natural bounds, so a thumb is the only thing saying
where in it you are, while everyone already knows a year starts at January and
ends at December. The list still scrolls (the native bar was always hidden);
there is just nothing drawn to say so. `useScrollThumb`'s `ref`/`onScroll` stay
on the month list — it still scrolls, and the active month is still scrolled
into view on open — only `ScrollbarThumb` and the two thumb values are gone,
along with the `relative` wrapper that existed to position it. Verified live:
scrolling the month list draws no thumb, the year list still does.

**2. "What about December 24 to January 15?" — a real hole in the plan, now
closed.** Dropping the current year is only safe when the range can't be
misread, and a range spanning a year boundary is precisely where it can:
"December 24 – January 15" reads as ending three weeks before it starts.

New `formatDateRange` (lib/format-date.ts) makes the rule conditional on the
range rather than on `now` alone:

| range | reads |
| --- | --- |
| both ends this year | `December 24 – December 31` |
| both ends 2027 | `December 24 – December 31, 2027` (year once, at the end) |
| **ends in different years** | `December 24, 2026 – January 15, 2027` |

The third case carries both years **even when one of them is the current one**,
which is exactly where a plain "drop the current year" rule would have got it
wrong. Five cases pinned in lib/format-date.test.ts.

`generate-calendar-column.tsx` lost its own local `formatDate` (a
`toLocaleDateString` with `year: "numeric"` — the last place still printing
the year unconditionally, flagged two rounds ago) and now calls the shared
one. Verified live on a range that already spanned the boundary:
"August 1, 2026 – February 11, 2027".

The same-year branch wasn't exercised in the browser on purpose — doing so
would have destroyed a 195-post range the user had set up on that screen. It
delegates to `formatFullDate`, which every post card and the post-details
heading already demonstrate, and the unit test covers it directly.

Gates: tsc clean, 154/154 tests (5 new), eslint unchanged (the only file with
errors is still generate-calendar-column.tsx's 10 pre-existing `react-hooks/
refs`, identical at HEAD).

### Same day — a bottom fade on the calendar's month and year lists

Both lists now dissolve at their bottom edge instead of ending on a hard line.
`useScrollFade` (the app's scroll-aware mask) at `end: 32`, matching
content-filter.tsx's bottom value — the closest analogue, a dropdown-style
list. **Bottom only, `start: 0`**, per direct request: it's the edge that has
to say "there's more below", which matters more on the month list now that it
draws no thumb. The top is one number away if it's ever wanted; because the
hook sizes each fade against the scroll actually remaining, a top fade would
be zero at rest and only appear once scrolled.

Two details:

- **The month list dropped `useScrollThumb` entirely.** With no thumb to draw,
  it was doing nothing for that list — the active month is scrolled into view
  through `activeMonthRef`, a child ref, which needs nothing from the
  container. `useScrollFade` replaces it outright.
- **The year list keeps its thumb *and* takes the fade**, so its two hooks are
  composed onto one node (callback ref calling both, one handler calling both
  `onScroll`s — the same shape content-view.tsx uses for its fade/memory
  pair). The thumb is a sibling of the scrolling div rather than a child, so
  the mask never dims it. Verified mid-scroll: thumb visible, "2036"
  dissolving at the bottom.

Also confirmed live in passing, on a range the user had set up meanwhile: the
**same-year non-current-year** branch of `formatDateRange` reads
"January 1 – January 29, 2027" — year once, at the end. That was the one case
left unexercised in the browser last round.

Gates: tsc clean, eslint clean (calendar.tsx 0 errors, same as HEAD),
154/154 tests. One run in between reported 153/154 — the same flaky
`lib/ai/generate.test.ts` live Gemini call timing out at 30s; it passed again
immediately after, as it did yesterday.

### Same day — back/forward navigation in the calendar's list views

From design-sync/calendarwithnavigation. The Day → Month → Year drill-down
could only ever be walked *forwards*, by picking something; there was no way
back. Both list views now carry `ArrowBendUpLeft` / `ArrowBendUpRight` either
side of their title (Phosphor, exactly the names the export uses, `size-5`,
`weight="bold"` — measured off the asset's 1.875px stem at a 20px viewBox,
which is Phosphor bold).

The existing flow is untouched, per direct request: tapping the day title
still opens the month list, picking a month still goes to years, picking a
year still returns to days.

| view | back | forward |
| --- | --- | --- |
| Select Month | → day | → year |
| Select Year | → month | **disabled** |

Forward is disabled on the year list because Year is the last step and the way
out of it is picking a year — which is the export's own greyed variant
(`#cac2bf` = `icon-minimal` against the enabled `#181210` = `icon-bold`).

**Stepping back is a pure view move** — neither handler touches
`displayMonth`, so backing out of a list leaves the calendar showing exactly
the month it showed before the list was opened. Only *picking* an entry moves
the date. Verified in-browser: opened the picker on August 2026, went forward
to years, back to months, back to days — still August 2026.

`CalendarNavButton` gained `tone` and `disabled`. The day view's month
chevrons rest at `icon-subtle` and darken on hover (unchanged); these rest at
`icon-bold`, as the export draws them. Disabled drops the pointer and the
hover entirely — a control that lights up and then does nothing is worse than
one that plainly says it can't.

Gates: tsc clean, eslint clean.

**Tests: 153/154, and the cause is now known rather than "flaky".** The
failure is `lib/ai/generate.test.ts`, and the real error underneath the 30s
timeouts seen earlier is:

> Quota exceeded for metric:
> `generativelanguage.googleapis.com/generate_content_free_tier_requests`,
> limit: 20, model: gemini-3.6-flash

It is a live call to the Gemini API on the free tier, unchanged from `HEAD`,
importing only `lib/ai/generate` — untouched by this branch. See FOLLOWUPS.

### Same day — one date format, app-wide

Per direct request that dates read the same everywhere: **`Aug 29`**, with the
year appearing only when it isn't the current one.

`formatFullDate` and `formatShortDate` are gone, replaced by a single
**`formatDate`**. Having two shapes was the whole problem, so there is now one
function and every caller takes it — collapsing them structurally is what
stops them drifting again. Every date display in the app was walked and
repointed:

- post-details heading (`AUG 28 • 10 AM`), the post cards, the dashboard's
  Next-up rows, the day deck's accessible name, the dashboard month-calendar's
  cell labels.
- **The Kanban column header**, which read `28th August`, now reads `Aug 28`.
  It took `monthLabel` — a string MonthBoard built by splitting `"July 2026"`
  on a space — and now takes a `dayLabel` built with `formatDayLabel`, the
  same helper behind the day deck's title, so a column header and a deck title
  can't disagree. The split-on-space hack is gone with it.
- **`formatDateRange`** now uses short months too: `Dec 24 – Dec 31`,
  `Dec 24 – Dec 31, 2027`, `Dec 24, 2026 – Jan 15, 2027`.
- **`project-folder.tsx`'s "Created" caption** was the last place spelling a
  date its own way (`toLocaleDateString`), and now reads `Created Jul 29`.

**Two deliberate exceptions**, both verified on screen:

- **The Content page's day chips keep their ordinals** — `28th`, `31st` —
  exactly as asked. A bare day *is* read as "the 28th"; that is what
  `formatOrdinal` is still for, and it is now its only caller.
- **`components/ui/calendar.tsx`'s day-cell `aria-label`** stays the verbose
  `"Saturday, August 28, 2026"`. It is read aloud rather than read, and a
  picker's cell needs its weekday and year said out loud even where the
  visible UI can take them as read. Renamed `formatFullDate` → `dayCellLabel`
  so it can't be confused with the retired shared name.

Verified in-browser across Kanban headers, Calendar day chips, the day deck's
cards, post details, the dashboard's Next-up list and /projects' folder
captions — all `Aug 29`-shaped, chips still ordinal.

Gates: tsc clean; eslint clean on every file this branch touched (the only
errors anywhere are generate-calendar-column.tsx's 10 pre-existing
`react-hooks/refs`, identical at HEAD); tests 153/154, still FOLLOWUPS #12's
Gemini free-tier quota and nothing else.

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

## 2026-08-28 15:49 — post-merge fixes from the post-time / settings-profile sweep

Done directly on `main` at the user's explicit instruction (they stopped the
branch creation and said to work here), so no branch or worktree.

**1. The hour stepper crossed 11↔12 wrongly, in both directions.**
`time-field.tsx`'s `step()` wrapped inside its own 1-12 span and never touched
the meridiem, which is a separate control. So ArrowUp from 11 AM committed
`{hour:12, meridiem:"AM"}`, which `to24Hour` correctly maps to `00:00` —
eleven hours *earlier*. ArrowDown from 12 PM gave 23:00. Confirmed by tracing
both before fixing. Worst on the Generate page, where one time applies to the
whole batch: arrowing past 11 silently rescheduled a month of posts to
midnight.

Fixed by moving the arithmetic into `lib/time-of-day.ts` as `stepHour`, which
goes through the 24-hour form and back — so the carry falls out of the one
function that already handles the 12 AM/12 PM pair correctly, rather than
being re-derived in a component. `TimeSegmentInput` gained an optional
`onStep` so the hour can override the default wrap-in-place while the minute
keeps it.

The telling part: `to24Hour` carries a comment calling 12 AM/PM "the one pair a
naive `hour + 12` gets wrong", and the conversion is exhaustively tested. The
*stepper* feeding it had no tests at all. It does now — both boundaries in both
directions, the 12→1 case that must **not** flip, and a walk right round the
dial and back asserting every single step moves exactly one hour.

**2. Arrows discarded a half-typed entry.** `step()` read the committed
`value`, so typing "0" over a 9 and pressing Up jumped to 10 with the typed
digit gone. It now seeds from the draft, clamped into range.

**3. The avatars bucket's UPDATE policy had no WITH CHECK.** Migration
`tighten_avatars_update_policy`. `create_avatars_bucket` (from
feat/settings-profile) gated INSERT and DELETE correctly on
`storage.foldername(name)[1] = auth.uid()`, but its UPDATE policy validated
only the row being *replaced*, not the row being written — so a user could
pass USING on their own object and rename it into another user's prefix. The
bucket is public-read, so that file would then be served to anyone as that
user's avatar. Recreated with the same predicate on both sides; strictly
tightening, every previously-legitimate update still passes.

Also filed FOLLOWUPS 14 for the save-queue gap on the time writes — see
LEARNINGS for why the debounce that's there isn't the same thing.

## 2026-08-28 16:40 — Log out spun forever on an expired session

**Symptom.** In `npm run preview`, confirming Log out left the button
spinning indefinitely; refreshing the page showed the login screen, so it
*looked* like the sign-out had worked. The server printed
`AuthApiError: Invalid Refresh Token: Refresh Token Not Found` twice.

**What the trace actually said.** Resolved the minified frames against
`.next/server/chunks/[root-of-the-server]__08mrxgj._.js`: the top three are
auth-js's `_request`/`_handleRequest`/`handleError`, the bottom two are the
retry promise inside `_refreshAccessToken`. Every one of those paths *returns*
the error rather than throwing it, and the print itself is auth-js's own
`console.error(err)` in `_recoverAndRefresh`'s catch — i.e. the logged error
was a symptom (a dead refresh token), not the failure.

**Cause.** The refresh token being dead is what makes `getUser()` yield no
user, and `lib/supabase/middleware.ts` redirected *any* request to a protected
route in that state — including the Server Action POST the Log out button
sends to the page's own URL. Confirmed against the running preview server:

    curl -X POST /projects/<id>/profile -H 'Next-Action: …' -H 'Cookie: sb-…'
    → 307 /login → (followed, header still attached) → 404 text/plain

React can't read a 404 as an action result, so the action promise never
settled, the `loggingOut` flag never cleared, and `logout()` never ran at all.
The refresh "logging them out" was just the same middleware redirecting a
normal GET.

**Fixes.**
1. `lib/supabase/middleware.ts` — the /login redirect is now `GET`-only. RLS
   and each action's own user check are what gate a POST; a 307 on one can
   only ever strand the caller.
2. `app/(auth)/logout/actions.ts` — `signOut()` can report an error *without*
   having cleared anything (on a broken session `_useSession` returns before
   `_removeSession`), so the `sb-…auth-token` cookies are now deleted by hand
   in that case. Logging out has to be final.
3. `components/profile/profile-screen.tsx` — the confirm handler is now a real
   `handleLogout` through `withNetworkStatus`: a redirecting action resolves
   (it doesn't reject — login-screen.tsx relies on the same), so anything in
   the catch is a genuine failure and hands the button back with a danger
   toast instead of spinning.

**Verification.** New `lib/supabase/middleware.test.ts` pins all three
branches (signed-out GET redirects, unprotected route passes, server-action
POST passes); the POST case fails on the old condition and passes on the new
one. tsc and eslint clean; `npm test` 171/172 with the one failure
(`lib/ai/generate.test.ts`, a live generation call) confirmed pre-existing on
a stashed tree. Not re-verified in a browser: rebuilding `.next` would have
disturbed the preview server already running on :3000.

## 2026-08-28 17:10 — Log out, part two: the redirect target was itself a redirect

The middleware fix above got the action running (the sign-out now happens),
but the button still never navigated: it stopped spinning, raised the new
"Couldn't log you out" toast, and only a manual refresh landed on the login
screen. So the action promise was now *rejecting* rather than hanging.

**Reproduced on the wire, no browser needed.** With the middleware fix in,
`logout` no longer needs a session to run, so it can be invoked over curl —
its action id came out of `.next/server/server-reference-manifest.json` (the
one id shared by `app/create-project/page` and
`app/projects/[projectId]/profile/page`):

    POST /create-project  Next-Action: 005be0…  →
      HTTP/1.1 303 See Other
      x-action-redirect: /login;push
      location: /signup?view=login        ← the bug
      content-type: text/x-component

**Cause.** `/login` is a redirect stub into the persisted signup flow.
`createRedirectRenderResult` (next/dist/server/app-render/action-handler.js)
renders the redirect target into the action's own response and copies that
render's headers onto it — and `location` is not in `actionsForbiddenHeaders`
(next/dist/server/lib/server-ipc/utils.js: only `content-length` and
`set-cookie`, on top of the IPC list). So the action answered 303 *with* a
Location, and the client's action `fetch` — plain `redirect: "follow"` —
followed it to the HTML page. `server-action-reducer.js` then saw neither an
RSC content-type nor an `x-action-redirect` on what came back and threw
"An unexpected response was received from the server" (E394), which landed in
the new `.catch` as the toast.

**Fix.** A Server Action must redirect to a *real* page, never at a stub.
New `lib/auth-routes.ts` holds `LOGIN_URL` / `FORGOT_PASSWORD_URL` so the stub
pages and the action can't drift apart; `logout()` redirects to `LOGIN_URL`
(`/signup?view=login`) directly.

**Verification.** Rebuilt and re-ran the same curl against a throwaway
`next start -p 3111` (left the preview server on :3000 alone, then stopped
3111):

    HTTP/1.1 303 See Other
    x-action-redirect: /signup?view=login;push
    content-type: text/x-component        ← no `location`, 11.8KB of real
                                             signup Flight data (was 9.1KB of
                                             redirect stub)

No Location means the browser can't follow it, so the reducer gets the shape
it expects and the router performs the navigation. tsc, eslint, build and the
middleware tests all clean.

## 2026-08-29 — Tooltip open delay: 200ms app-wide

Was 600ms (`TooltipProvider`'s default *and* Base UI's own `OPEN_DELAY`, which
provider-less triggers — most of them — fell back to), with two local
overrides: Generate's model/account pills at 300ms and the dashboard's
total-posts bar at 0.

`TOOLTIP_OPEN_DELAY_MS = 200` in components/ui/tooltip.tsx, plus a single
`TooltipProvider` around `{children}` in app/layout.tsx — without that the new
default would only have reached tooltips already inside a Provider. Generate's pills dropped their
`delay` and inherit it; the dashboard bar keeps `delay={0}` by request — those
percentages should show on contact. Both Providers stay either way, since
they're also what groups their tooltips (Base UI shows the next one in a group
instantly). Side effect worth knowing: that grouping is now app-wide.

Provider renders context only (`TooltipProviderContext` + `FloatingDelayGroup`,
no DOM), so wrapping the layout's children doesn't touch the body's flex
column. tsc + eslint clean. Not seen live — the :3000 preview server is serving
the previous build.

## 2026-08-29 — A quota hit says so, instead of "couldn't regenerate that post"

**The gap.** `classifyGenerationError` (lib/ai/generate.ts) has mapped a 429 to
`rate_limit` all along, and the batch's total-failure screen reads it — but
every *regenerate* path threw the reason away and showed one generic line, so a
provider saying "You exceeded your current quota, please check your plan and
billing details" reached the user as "Couldn't regenerate that post".

**New `lib/ai/failure-copy.ts`.** One `NAMED_FAILURES` map — currently just
`rate_limit` → "You exceeded your model quota" / "Try again later" — and
`generationFailureCopy(reason, fallback)`, which hands back the call site's own
line for every reason it doesn't name. Deliberately small: it's the exception
list, not a second copy deck competing with `TOTAL_FAILURE_MESSAGES`
(generating-view.tsx), which says the same things at the length that screen
has. `reason` is typed `string | undefined` rather than the union, because one
caller reads it off a stream where it's just text — an unknown value falls back
rather than producing an empty toast.

**The streaming path needed the reason plumbed through.** post-details'
regenerate goes through app/api/regenerate-post/route.ts, whose framing tee saw
`part.type === "error"` and recorded only *that* it failed. It now classifies
`part.error` (and anything thrown while draining) and writes the reason
directly behind `STREAM_ERROR_MARKER`, in the same enqueue. The client drains
whatever is left before deciding — one server write is not guaranteed to arrive
as one chunk, and the server closes immediately after that write so the drain
can't wait on a live generation — then splits on the marker. Falls back to the
old line if the tail never lands.

**Call sites.** post-details.tsx (stream), day-deck.tsx and generating-view.tsx
(both already had `result.reason` from the `regeneratePost` action and were
ignoring it). Both of the latter had a message-only `showError`; they now carry
`extraInfo` through to the Toast, held in its own state so it can't blank out
mid-exit-animation.

**Verification.** `lib/ai/failure-copy.test.ts` builds the real thing — an
`APICallError` with `statusCode: 429` carrying the provider's own quota
sentence, wrapped in the `RetryError` the SDK surfaces after its retries — and
pins classify → copy, the non-429 fallbacks, and the marker round trip. Full
suite 178/178 (lib/ai/generate.test.ts, which was failing on the previous two
runs, passes again — it makes a real model call, so it was plausibly failing on
the very quota this task is about). tsc clean; eslint clean apart from the
pre-existing `set-state-in-effect` in generating-view.tsx (confirmed on a
stashed tree). The quota path itself isn't exercised live — that needs a
genuinely exhausted key.

## 2026-08-29 — /profile is a real screen, not a doorway into a project

`/profile` (and `/settings`) forwarded into the user's *first* project, so
opening the account screen from the picker silently decided which project you
were in. Per direct request it's now a standalone page — same screen, picker
chrome, no sidebar. A modal was considered and rejected by the user: the screen
is expected to grow, and a dialog holding more would be unusable on a phone.

- `components/profile/profile-content.tsx` — new async Server Component with
  the user fetch and the name/email/member-since derivations that
  `app/projects/[projectId]/profile/page.tsx` used to own. Both routes render
  it; that page is now four lines.
- `app/profile/page.tsx` — auth guard, then the same shell as the in-project
  layout (`h-screen`, same padding scale) with `ProjectsNavbar
  backHref="/projects"` over a `SectionScrollArea`. Reusing that scroll area is
  not just convenience: this screen renders a `position: fixed` Toast inside it
  (the logout failure toast), which is exactly why its fade is an overlay strip
  rather than a CSS mask.
- **`projectId` is optional the whole way down** — ProfileScreen →
  EditableName / ChangePasswordPanel / AiModelsPanel / AddModelModal →
  `updateDisplayName`, `addUserAiModel`, `deleteUserAiModel`. It was only ever
  a `revalidatePath` argument (and one React `key`): every field on this screen
  is user-scoped. Off a project, `updateDisplayName` revalidates `/profile`
  (whose own page renders the navbar chip) and `/projects` (where the old name
  would otherwise be waiting on the way back); the model actions revalidate
  whichever copy of the screen the caller is on, via a new `revalidateProfile`
  helper.
- **"Replay onboarding" renders only in a project.** The context's default
  value makes `restart()` a no-op with no provider, so out here the row would
  have sat there doing nothing visible — and the tour narrates the sidebar,
  which this route doesn't have.
- `app/settings/page.tsx` forwards to `/profile` and no longer looks up
  projects. `/projects/<id>/settings` still forwards to that project's profile.

**Verified in-browser** against a throwaway `next start -p 3111` (the preview
server on :3000 left alone, 3111 stopped afterwards): the picker's name chip
lands on `/profile` and *stays* there (`location.pathname === "/profile"`,
where it used to bounce to `/projects/<first>/profile`); the page renders
navbar + centred account column with no sidebar and no Replay row; Back returns
to `/projects`; and the in-project profile is unchanged, sidebar and Replay row
included. tsc and eslint clean. `npm test` 177/178 — `lib/ai/generate.test.ts`
fails on a real 429 from Gemini ("Quota exceeded for metric …
generate_content_free_tier_requests, limit: 20"), i.e. the live free-tier quota,
not this change.

## 2026-08-29 — Add-a-model modal: copy, type scale, provider combobox

Four requested changes to `components/settings/add-model-modal.tsx`, plus the
root cause of the error it threw on open.

- **The modal's on-open error was never a code bug — `AI_GATEWAY_API_KEY` was
  simply absent from `.env.local`.** Reproduced directly against the installed
  SDK: `gateway.getAvailableModels()` throws
  `GatewayAuthenticationError: No authentication provided.`, which
  `listGatewayProviders` catches and reports as "Couldn't load the model
  catalog." The var is documented in `.env.local.example` ("needed explicitly
  for local dev") and had just never been filled in. With the key added the
  catalog returns **216 language models across 28 providers**, Anthropic
  included. Note the built-in Gemini path is unaffected either way — it calls
  `google()` on `GOOGLE_GENERATIVE_AI_API_KEY` and never touches the gateway.
- `DialogDescription` gets `text-body-lg` (both stages — same slot, so the
  model-stage line moves with it), and the key-stage copy loses its em dash:
  "Bring your own API key. Your posts generate on your account, not Presto's."
- **The Provider field is now a combobox, not a `SelectPill`** — new
  `components/settings/provider-combobox.tsx`, structurally
  `model-combobox.tsx` (itself `topic-picker.tsx`'s combobox) minus the leading
  search icon, per request, and minus the right-hand price column, since a
  provider has no single price. It uses `PillInput`'s own `label` prop, so the
  hand-rolled `<span>Provider</span>` above the old pill is gone and the field
  now matches the Model field's structure exactly. A plain dropdown over 28
  providers was the thing that motivated this.
- Helper copy under the API key field: "Encrypted. Presto never shows it
  again.", at regular weight. **The weight is opt-in, not a changed default.**
  `PillInput` gained a `helperTextClassName` prop because nearly every other
  `helperText` in the app is a validation error (the four signup screens,
  change-password) that should stay bold — only descriptive helper text wants
  regular. The modal passes `font-medium`, which is this system's regular body
  weight (`--text-body-md--font-weight: 500`) and evicts the base `font-bold`
  through tailwind-merge's font-weight group.
- Dropped the now-unused `providerOptions` derivation and the `SelectPill` /
  `CaretDown` imports.

**Verified in-browser on :3001** (this worktree's port): the description reads
without the em dash at the larger size, and the helper line reads "Encrypted.
Presto never shows it again." at regular weight beside the still-bold error
below it. **The Provider combobox itself is unverified** — the dev server had
booted before the gateway key was added, so `listGatewayProviders` was still
failing and the field never rendered; a PID-scoped restart of :3001 was blocked
by the permission classifier, so this needs re-checking after a restart. tsc and
eslint clean on all three changed files.

**Follow-up, same task.** Provider placeholder is now "Choose provider" (was
`Search {n} providers`), and a *picked* provider renders `text-text-bold`
instead of staying grey. The colour switch is a conditional
`placeholder:text-text-bold` on the input rather than a change to how selection
is stored: this combobox deliberately keeps the chosen value in the
*placeholder* slot so the field stays a live search box (clicking back in to
change your mind doesn't mean clearing text first), and the cost of that trick
is that a real choice inherits `placeholder:text-text-subtle` and reads as
unfilled prompt text. Overriding the colour is what makes the trick survive.

**Verified in-browser on :3001** after the dev server picked up
`AI_GATEWAY_API_KEY`: the modal opens with no error, the Provider combobox
renders with no search icon, typing "anth" filters 28 providers down to
Anthropic, and picking it renders "Anthropic" in black against the visibly
grey "Paste your key" placeholder below. Description reads at body-lg without
the em dash; the helper line reads at regular weight beside the bold field
labels. tsc + eslint clean.

**Known, unresolved:** `loadProviders` preselects Google on open, so
"Choose provider" is only reachable if that preselect finds nothing. Left as-is
rather than dropping the preselect, which wasn't asked for — flagged to the
user.

## 2026-08-29 — Add-a-model modal, round 3

- `ModelCombobox` gets the same `placeholder:text-text-bold`-when-selected
  treatment `ProviderCombobox` just got — both park the chosen value in the
  placeholder slot to stay a live search box, so both need the colour override
  or a real choice reads as unfilled prompt text.
- Name field helper → "How it appears in Generate's model picker.", regular
  weight via `helperTextClassName="font-medium"`.
- **`FieldError` is now `body-lg-bold` with a top-aligned icon** — `items-start`
  plus an icon wrapper sized to `--text-body-lg-bold--line-height`, so the icon
  sits optically centred on the *first* line and a wrapped two-line message
  doesn't leave it floating in the middle. Line-height token rather than a
  hardcoded 4px offset, which would be an invented spacing value.
  **Blast radius:** FieldError is shared — this also restyles the
  writing-style modal, the reference modal and UploadDropzone. Taken as
  deliberate (one error treatment app-wide beats two), flagged to the user.
- **The "that key didn't work" error on a funded-but-empty Anthropic account was
  our copy being wrong, not the key.** `verifyProviderKey` had a single bare
  `catch` blaming the key for every failure. A provider rejects an unfunded
  account with a **400 whose body names the balance** ("Your credit balance is
  too low to access the Anthropic API"), not with a 401/403 — so the status
  alone can't tell it from a malformed request, and the old copy sent the user
  off to re-copy a key that was fine. New `verifyFailureCopy` unwraps
  `RetryError` → `APICallError` (same unwrap as `classifyGenerationError`) and
  splits four ways: no credit (402 **or** message matching
  `/credit|balance|billing|insufficient|payment|fund/i`), 429 rate limit,
  401/403 bad key, else the old generic line.
  **Unverified against the real failure** — reproducing it needs the user's own
  Anthropic key, so the 400-with-balance-message shape is from the provider's
  documented behaviour, not from a captured response here.

**Round 3 verification + a bug and a blocker found while testing.**
- Verified in-browser on :3001: FieldError now renders `body-lg-bold` with the
  icon sitting on the first line of a three-line message.
- **Bug found and fixed: the provider preselect never re-ran on a reopen.**
  `loadProviders` early-returned when `providers.length > 0`, but `reset()`
  clears `providerSlug` on close — so the second and every later open showed
  "Choose provider" with Continue permanently disabled. Split the guard so a
  cached catalog still reapplies the default (`preferredSlug`, extracted).
  Verified: reopening now lands on Google again.
- **Blocker found: BYOK cannot work on this gateway account yet.** See the new
  LEARNINGS entry — Vercel gates BYOK behind paid gateway credits, and the
  failure arrives as a `GatewayInternalServerError`, not an `APICallError`, so
  the classification added earlier this task matched nothing. Rewrote
  `verifyFailureCopy` to duck-type `statusCode`/`message` and to check the
  BYOK-needs-credits case *before* the 401/403 branch (it is a 403).

## 2026-08-29 — Round 4

- Name field autofills from the picked model (`onChange` sets both), still a
  plain editable input; changing model overwrites, since it's overwriting a
  name we chose rather than one they typed.
- Em dash out of the gateway-credits error copy.
- **Ran down "Claude 3 Haiku worked, the others failed".** It didn't work — see
  the new LEARNINGS entry. Haiku is free-tier, so the gateway served it on its
  own account and ignored the BYOK key; a deliberately fake key reproduces it
  exactly (rate-limit error, not auth). Fixed by adding `confirmedRanOnByok`
  (requires `isByok === true`) and switching `verifyProviderKey` onto it, so
  add-time verification fails closed while `didFallBackOffByok` keeps its
  lenient contract for the post-generation path it was written for.
- tsc, eslint, vitest 178/178 all clean.

## 2026-08-29 — Round 5

- **Delete now asks first.** `AiModelsPanel` holds a `pendingDelete` row and
  renders the existing `ConfirmationModal` (same shape as connections-panel's
  disconnect and post-details' delete — reused, not reinvented). The delete
  itself stays optimistic per AGENTS.md: the modal gates *starting* it, it
  doesn't turn it into a wait-for-the-server operation.
- Gateway-credits copy is now "Add AI Gateway credits to use your {Provider}
  key." Both the outright-403 branch and the ran-on-our-account branch use it —
  different causes, identical remedy, and the distinction is ours to care about
  rather than the reader's.
- **Verified end-to-end** by seeding a throwaway `user_ai_models` row via the
  Supabase MCP (there is no `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` to
  script against): the row rendered, the trash button opened the modal with the
  right title and copy, Delete removed it, and `select count(*)` came back 0 —
  so the row is gone and no test data was left behind.

## 2026-08-29 — BYOK moves off the Vercel AI Gateway to direct provider SDKs (Anthropic first)

The gateway went for two reasons, one commercial and one correctness. Commercial:
BYOK there requires **paid credits on our own gateway account**, so we'd pay in
order to let users pay for their own inference. Correctness: a middleman can
substitute its own credentials, which it silently did for free-tier-eligible
models — that's the fake-key-looks-valid trap in LEARNINGS.md. A direct call has
neither property.

**Packages added** (both official, user-authorized): `@ai-sdk/anthropic@4.0.45`
for generation, `@anthropic-ai/sdk@0.122.0` for `client.models.list()`. The
latter is the documented way to enumerate models; a hand-rolled fetch against
`/v1/models` was rejected on the claude-api skill's rule that raw HTTP is wrong
where an official SDK exists.

- **New `lib/ai/providers.ts`** is the whole seam: a `DirectProvider` per
  provider with `listModels(apiKey)` and `languageModel(apiKey, modelId)`.
  Adding OpenAI later is one entry plus a package — nothing else in the app
  changes. Model ids stay **prefixed** (`anthropic/claude-sonnet-5`) so the
  provider is recoverable from the stored id alone and the existing
  `gateway_model_id` column, its cross-checks, and every downstream consumer
  keep working unchanged. **No migration** — the column name is now a slight
  misnomer, deliberately: renaming it is a schema change for zero behavioural
  gain, and schema changes are serialized across worktrees.
- `lib/ai/generate.ts` gained `modelFor(selection)` as the single place a
  `ModelSelection` becomes a callable model. The **built-in branch is
  byte-for-byte unchanged**, so that path can't regress. `providerOptions`,
  `generationId`, `didFallBackOffByok` and `confirmedRanOnByok` are all gone —
  there is no fallback to detect once the call is direct — which also deleted
  the post-generation bookkeeping in post-actions.ts and the regenerate route.
- **`url_context` is now explicitly gated to the built-in.** It's a
  provider-executed *Google* tool; previously the gateway path would have been
  handed it too. A BYOK model therefore sees a URL entry as plain prompt text
  rather than fetched content — a real capability difference, now explicit at
  the call site instead of implicit.
- **Key verification is now free.** Listing models with the key *is* the check:
  a bad key fails with the provider's own 401 and no tokens are generated. The
  old path had to burn a real one-token generation because the gateway had no
  per-key catalog endpoint. `addUserAiModel` re-lists rather than re-generating,
  and confirms the chosen model is in that key's catalog. Deliberately **not** a
  trial generation: that would charge the user to save a row, and would reject a
  valid key on an unfunded account — a billing problem better discovered at
  generation time than a reason to refuse to store the key.
- `listGatewayProviders` no longer touches the network; it returns the registry.
  So the modal can no longer fail on open, which is where this whole thread
  started.
- `AI_GATEWAY_API_KEY` is referenced nowhere in code any more and is dropped from
  `.env.local.example`.

**Gates:** tsc clean, eslint clean on every changed file (repo-wide error count
unchanged at 18, all pre-existing `react-hooks/refs`), vitest 178/178,
`npm run build` succeeds. **Verified in-browser on :3001** that the modal opens
with Anthropic preselected, no error and no network call. **Not yet verified:
the key → model-list → save → generate path**, which needs a real Anthropic key.

## 2026-08-30 — OpenAI added to the direct-provider registry

Packages: `@ai-sdk/openai@4.0.51` (generation) + `openai@7.8.0` (`models.list()`),
mirroring the Anthropic pair. The registry seam held — `lib/ai/providers.ts` is
the only source file that changed.

**The one real difference from Anthropic, and it needed handling.** OpenAI's
`/v1/models` publishes **no `display_name` and no type/modality field** (checked
against the installed SDK's own `Model` interface: `id`, `created`, `object`,
`owned_by`, `shutdown_date` — that's all). Anthropic's gives both. So:

- **Chat models are separated by id alone**, in two passes: allowlist the text
  families (`gpt`/`chatgpt`/`codex`/`o<digit>`), then subtract the non-text
  modalities that share those prefixes — `gpt-4o-audio-preview`, `gpt-image-1`
  and `gpt-4o-transcribe` all start with "gpt-". Over-excluding is the cheaper
  error: an omitted model is merely invisible, whereas an included image model
  fails at generation time with a baffling provider error.
- **`lib/ai/providers.test.ts` pins the heuristic** against real catalog ids in
  both directions, because there's no live OpenAI key here to verify it against
  and a silent regression would be invisible until someone couldn't find their
  model. 6 tests, also covering `bareModelId`/`providerSlugOf`.
- The id doubles as the label, with one cosmetic touch: `gpt` → `GPT`,
  `chatgpt` → `ChatGPT`, matching OpenAI's own casing. Nothing else invented.
- Results are sorted; unlike Anthropic's short list, OpenAI returns dozens of
  dated snapshots in no useful order.

**Gates:** tsc clean, eslint clean, vitest 184/184 (was 178 + 6 new).
**Verified in-browser on :3001**: the provider combobox now lists Anthropic and
OpenAI, and the user's real saved Anthropic models (Claude Sonnet 5, Claude
Fable 5, one key ending TwAA) render correctly — so the Anthropic path is
confirmed working end to end by the user. **Not verified: the OpenAI key →
model-list → save path**, which needs a real OpenAI key.

## 2026-08-30 — AI models list redesigned from ProfileScreenRedesign, and made scrollable

Read `design-sync/profilescreenredesign/` (frame.json + screenshot) per the
figma-bridge skill. Spec and rationale in INTERFACE.md; notes here on what the
export changed and what it didn't say.

- The per-model **card** became a **row in a shared tray**. The old entry drew
  an icon + label header over a bordered surface-3 box containing the model id
  and key tail; the export drops the icon and the raw model id, and folds
  everything into one 52px row: label over `{Provider} key ending ***{last4}`.
- **`lib/ai/provider-names.ts` is new and exists for a bundling reason.** The
  row needs a provider's display name, but `lib/ai/providers.ts` imports
  `@anthropic-ai/sdk` and `openai` — importing it from a client component would
  ship both SDKs to the browser. The names are now data in their own module,
  used by the registry *and* the UI, so there's still one source of truth.
- **The export draws no error state**, but `status === "error"` is real, so it
  stays — folded inside the row rather than given its own block, so a broken
  model still reads as one list item.
- Copy per the export: "Add your API key to generate on your own account and
  control your costs."
- **Bug found and fixed while comparing against the export:** the subtitle
  rendered as "Anthropickey ending" — a JSX whitespace trap, now in LEARNINGS.md.
  Switched to a single template string, which also picked up the export's `***`
  in place of the app's older bullet masking.

**Gates:** tsc, eslint, vitest 184/184. **Verified in-browser on :3001** against
three rows (two real, one seeded and removed afterwards): every measurement
matches the export and the tray scrolls.

## 2026-08-30 — Small items

- Delete-model confirmation title is now the generic "Delete this model" rather
  than naming the row. The trash button's `aria-label` stays model-specific — a
  screen reader user hears it without the visual row context, so that's the one
  place the name still earns its keep.
- **TasteTest is first in the Generate page's model pill.** The trap: all three
  "what's the default model" sites read `BUILTIN_MODEL_OPTIONS[0]`, so simply
  reordering the array would silently have made canned content the default for
  every new visit *and* every repair of a stale selection. Split into a named
  `DEFAULT_MODEL_ID` so display order and the default are independent.
  It needs the explicit `: string` annotation — inferring `BuiltinModel` from
  `BUILTIN_MODEL_ID` narrows the state union and rejects every user-model uuid.
  Verified in-browser: order is TasteTest / Gemini 3.6 Flash / Claude Sonnet 5 /
  ChatGPT-5, and the persisted selection survived the reorder.
- Incidental confirmation from that screenshot: **the OpenAI BYOK path works
  end to end** — the user has a real ChatGPT-5 model saved and selected.

## 2026-08-30 — Instructions work on every model: URL entries fetched server-side

Raised by the user: "all models should be able to support what's on the
instructions. why's that just a built-in option?" Correct, and the previous
state was worse than unsupported.

**What was wrong.** A "url" writing-style/reference entry put
`Available at this URL: <url>` into the prompt, and the *fetching* was
`google.tools.urlContext()` — a provider-executed Google tool, gated to the
built-in. So on Anthropic or OpenAI the model was told a URL was available and
had no way to read it, which invites writing as though it had.

**The fix inverts where the work happens.** `lib/ai/fetch-url.ts` fetches the
page in `resolveAttachment` and `build-prompt.ts` inlines the extracted text,
so every provider receives identical content and nothing depends on which model
is selected. `useUrlContext`, the `url_context` tool and the `ToolSet` cast are
all gone; **`lib/ai/generate.ts` now has no provider-specific branch left at
all** beyond choosing the model itself.

- **Option not taken: per-provider fetch tools.** Anthropic and OpenAI both
  have web-fetch/search tools, so the capability *could* have been mapped per
  provider. Rejected because it re-creates the matrix this was meant to remove:
  three tool shapes, three availability/pricing stories, and a feature that
  still silently varies by model. Fetching once ourselves is uniform, cheaper,
  debuggable, and identical for whatever provider is added next.
- **A failed fetch is stated, not hidden.** The prompt says
  "(couldn't read <url> — don't assume anything about its contents)" rather
  than dropping the entry or repeating the old "available" phrasing. Pinned by
  a test, since this is the exact failure the old copy caused.
- Guards, because this fetches user-supplied URLs from the server: http(s)
  only, private/loopback/link-local hosts refused (incl. the cloud metadata
  address), 10s timeout, 2MB body cap checked before *and* after reading (a
  chunked response has no Content-Length), text content types only, 20k chars
  into the prompt. These are typo-and-copied-internal-link guards — the entries
  are the user's own; a hostile SSRF would need DNS-level checks, which is
  disproportionate here and still wouldn't be airtight.
- HTML to text is hand-rolled (no parser dependency): drop script/style/head,
  turn block closes into newlines, unwrap tags, decode the handful of entities
  that appear in prose, collapse whitespace. A JS-rendered page wouldn't survive
  a plain fetch with or without a parser.

**Still provider-dependent, and not fixed here: file entries.** `fileParts` are
already sent to every model, but native support differs — Gemini reads PDF and
DOCX, Anthropic reads PDF, OpenAI differs again. Making files uniform means
extracting their text server-side too, which needs a PDF/DOCX parser package,
so it needs asking first. Flagged to the user.

**Gates:** tsc, eslint, vitest 195/195 (185 + 10 new), `npm run build` clean.

## 2026-08-30 — File entries extracted server-side; Google added as a provider

### Files now work on every model
`lib/ai/extract-file-text.ts` — `unpdf@1.8.1` (MIT) for PDF, `mammoth@1.12.2`
(BSD-2) for DOCX, a plain `TextDecoder` for .txt. The same inversion the URL
change made: extract to text here rather than shipping bytes and hoping the
provider understands them.

- **`fileParts` is gone entirely**, and with it the last provider-dependent
  branch in `lib/ai/generate.ts` — the call is now literally
  `{ model: modelFor(...), temperature, prompt }`. Support used to vary (Gemini
  reads PDF+DOCX, Anthropic PDF, OpenAI differently again); now every provider
  gets the same words.
- It's also cheaper: a base64 PDF is far more tokens than the prose inside it,
  and for a *writing sample* the prose is the whole point — layout and images
  say nothing about tone or structure.
- **`unpdf` chosen over `pdfjs-dist` and `pdf-parse`**: it wraps a bundled
  pdfjs build for serverless/Node without the worker-and-canvas setup
  `pdfjs-dist` needs under Next. Verified on a hand-built single-page PDF
  before wiring anything: 1 page, text `"Presto extraction works"`.
  `npm run build` passes with both packages in the server bundle.
- **Legacy binary `.doc` is deliberately unsupported** — pre-XML OLE, which
  mammoth doesn't read. Such a file resolves to null and is reported as
  unreadable rather than silently contributing nothing. It's still an accepted
  upload type; worth deciding separately whether to stop accepting it.

### Google as the third BYOK provider
No new AI package (`@ai-sdk/google` was already there for the built-in), and
the factory is `createGoogle`.

- **The only provider listed over plain REST**, since Google ships no Node SDK
  for it. The key goes in the `x-goog-api-key` **header**, not Google's
  documented `?key=` query parameter — a credential in a URL lands in proxy and
  server logs.
- Easiest filter of the three: the response carries `displayName` *and*
  `supportedGenerationMethods`, so text models are an exact
  `includes("generateContent")` check rather than OpenAI's id heuristics.
  Verified against the real key: 200, 39 models, real display names.
- Note it therefore also lists Deep Research / Computer Use / Antigravity
  models, which do support `generateContent` but aren't natural post writers.
  Left in: they genuinely work, and inventing exclusions for the one provider
  that publishes real capability data would be a step backwards.

**A repair worth recording:** a regex written to strip the `fileParts`
destructure over-matched to a later `])` and deleted 136 lines of
post-actions.ts. Caught immediately by tsc, restored with `git checkout --` on
that one file, and redone with exact-string replacements. Multi-line regex
edits against source get an anchored, asserted replacement — not `[^\n]*` runs.

**Gates:** tsc, eslint, vitest 195/195, `npm run build` clean. **Verified
in-browser on :3001**: the provider list now reads Anthropic / Google / OpenAI.

## 2026-08-31 — Groq added as a free-tier provider

Picked over Cerebras and Mistral on the numbers that matter here: a 31-post
batch is 31 requests, and Groq's free tier allows 30/min and 14,400/day with no
card. Cerebras' 1M tokens/day is the better headline but its 5 req/min would
stretch that same batch over six minutes.

- **One new package, `@ai-sdk/groq`, and no second listing SDK.** Groq's API is
  OpenAI-compatible, so `listModels` reuses the `openai` client already
  installed, pointed at `https://api.groq.com/openai/v1`. Generation still goes
  through `@ai-sdk/groq` (`createGroq`), which knows the provider's own quirks.
  This is the pattern for Cerebras/Together too if they're added later.
- Filtering is the OpenAI problem again — mixed modalities, no type field — but
  Groq's non-text families are narrower (whisper/tts speech, llama-guard and
  prompt-guard moderation), so a blocklist alone carries it without OpenAI's
  family allowlist. `isGroqTextModel` is exported and pinned by tests against
  real catalog ids in both directions, same as the OpenAI filter, since there's
  no Groq key here to check against.
- A retired model still appears in Groq's list with `active: false` — a field
  the OpenAI types don't declare — so it's read through a narrow cast and
  skipped.

**Unrelated fix, found by the suite:** `lib/ai/generate.test.ts` timed out. Not
a regression from dropping `messages` for `prompt` in generatePost — verified by
running that exact call shape against Gemini directly (succeeded, ~20s for a
two-token reply). The free tier is simply slow enough that a whole post ran past
the old 30s cap, so the timeout is now 90s with the measurement recorded in the
comment.

**Gates:** tsc, eslint, vitest 197/197, `npm run build` clean. **Verified
in-browser on :3001**: provider list reads Anthropic / Google / Groq / OpenAI.

## 2026-08-31 — Loose ends before handoff

- **`keyHint` is no longer dead.** It now fills the API-key field's placeholder
  (`AIza…`, `gsk_…`, `sk-ant-…`, `sk-…`), carried through
  `GatewayProviderOption` from the server action rather than imported — the
  modal is a client component and `lib/ai/providers.ts` pulls in the vendor
  SDKs. Verified live: provider Google → placeholder `AIza…`.
- **Legacy `.doc` is no longer accepted** — dropped from both instruction
  actions' `ALLOWED_FILE_EXTENSIONS`, the dropzone's `accept`, and
  attachments.ts's media-type map, since extract-file-text.ts can't read the
  pre-XML OLE format and storing one would contribute nothing to a generation.
  `file-type-icon.tsx` keeps its `doc` entry so any already-stored row still
  renders an icon.
- **Google's model list is filtered to actual writers** — see the new LEARNINGS
  entry. This also corrects a claim made in this file two days ago: the
  `supportedGenerationMethods` check was described as exact, and it isn't.
  Checked against the live catalog: 39 list `generateContent`, 20 can write.
  `isGoogleWritingModel` is exported and tested like the other two filters.

**Gates:** tsc clean, eslint at baseline (17 pre-existing errors, 0 warnings),
vitest 199/199, `npm run build` clean.

**Confirmed working by the user in-browser, beyond what I could test:** Groq
BYOK end to end — a "groq compound" model is saved against a real Groq key
(***oCfm), alongside their Anthropic and OpenAI models.

**Still unexercised:** a real generation with a URL entry and with a PDF/DOCX
entry in Instructions. Those are the two paths that changed how *every* model
receives Instructions, including the built-in Gemini, so they're worth running
before merge. Nothing is committed yet.

## 2026-08-31 — Two combobox bugs, and verifying the Instructions rework

### Combobox bugs (both reported, both in the shared pattern)
Fixed in `provider-combobox.tsx` **and** `model-combobox.tsx` — same component
shape, so the Model field had both bugs too and nobody had hit them yet.

1. **The menu wouldn't reopen after picking.** `pick()` sets `focused` false,
   but the menu's own `onMouseDown` preventDefault deliberately keeps DOM focus
   on the input — so a second click fires no `focus` event and nothing reopened
   it. Now `onClick` opens it as well, and typing (`onChange`) does too, since a
   filtered list you can't see is worse than no list. Proved in-browser with the
   exact precondition visible in the log: `inputStillHasDomFocus: true` *and*
   `REOPENS_ON_SECOND_CLICK: true`.
2. **Gibberish stayed in the field while the real selection sat underneath.**
   The chosen value lives in the *placeholder* (so the field stays a live
   search box), which means leftover query text visually replaces it while the
   selection is unchanged — the field claims something never selected. `onBlur`
   now clears the query, so an unfocused field always shows what's actually
   selected. Proved: typed `aodhdhd` against a Groq selection, blurred, value
   cleared to `""` and the field reads Groq again.

### The Instructions rework, verified against real inputs
There were no `url` or `file` entries in the database, so the two changed paths
had nothing to exercise in-app. Ran them through the real production functions
instead (temporary vitest file, deleted after):

- `fetchUrlText("https://example.com/")` → `"Example Domain\nThis domain is for
  use in documentation examples…"`, and `buildPostPrompt` emits
  `From https://example.com/: …` carrying that text.
- `extractFileText("application/pdf", …)` on a real PDF → `"Presto extraction
  works"`, and the prompt emits `From sample.pdf: …` carrying it.

**What that does and doesn't prove.** It covers fetch → htmlToText → prompt and
PDF bytes → extract → prompt, which is all the code that changed. The one seam
still unexercised is Supabase Storage `download()` → `arrayBuffer()` inside
`resolveAttachment` — unchanged pre-existing code that only supplies the bytes.
A real in-app generation with a URL and a PDF in Instructions is still the
honest final check, and needs those entries to exist.

**Gates:** tsc clean, eslint at baseline (17 pre-existing), vitest 199/199,
`npm run build` clean. Still nothing committed.

**End-to-end verification of the Instructions rework, in the real app.** Added a
URL reference (`https://example.com/`) and uploaded a PDF reference through the
UI, then generated one post on the user's own Groq BYOK model.

The generation succeeded — but *success alone proves nothing here*, because
`resolveAttachment` swallows a failed Storage download and simply drops the
entry. The decisive evidence is in Supabase's edge logs:

```
POST /storage/v1/object/content-reference-files/…sample.pdf  200  13:36:51  ← upload
GET  /storage/v1/object/content-reference-files/…sample.pdf  200  13:38:53  ← the generation
```

That GET is `resolveAttachment` downloading the file mid-generation, which was
the one seam the earlier function-level checks couldn't reach. Combined with
those (fetch → htmlToText → prompt, and PDF bytes → unpdf → prompt, both
asserted against real inputs), every link in the new path is now exercised.

**Test data removed afterwards**, verified by query: `content_references` 0,
`storage.objects` in that bucket 0 (so the delete action's Storage cleanup works
too), no posts created in the last two hours, and the user's own 3 writing
styles untouched.

## 2026-08-31 — Password managers autofilling the Add-a-model dialog

Reported on Dia: opening the dialog pasted the user's email into Provider and a
saved password into API key. Not app logic — see the new LEARNINGS entry for
why `autoComplete="off"` (already present) never had a chance.

Fixed on both halves of the pair the heuristic matches: the API key field is now
`autoComplete="new-password"` with `name="provider-api-key"` and the
1Password/LastPass/Bitwarden `data-*` opt-outs; the provider and model comboboxes
and the Name field get `autoComplete="off"` plus the same opt-outs.

**Not verified in-browser** — the Chrome extension disconnected right as this
landed. Confirmed statically that the props reach the DOM (`PillInput` spreads
onto `Input`, which spreads onto Base UI's `input`), and gates are clean, but
the actual Dia behaviour is unconfirmed and the user should re-check.
---

## 2026-08-31 — LinkedIn publishing groundwork, built refused-by-default

`feat/connection-expiry` (branch name predates the task — this is publishing
groundwork, not the expiry work its slug names; the branch was empty when
picked up). Explicitly authorized: "groundwork, scope flip last", with the
standing instruction that no live post fires without asking first. **Nothing
was published, and nothing can be.**

**One thing I got wrong first and corrected before writing code.** I reported
that the author URN wasn't stored and would need a migration. It is stored:
`social_accounts.provider_account_id` holds the OIDC `sub` and the callback has
written it since the connections branch — `fetchSocialAccounts` simply omits it
from its `.select()`, correctly, because no client needs it. Confirmed against
the live table. So this task needed **no schema change at all**, didn't claim
the schema lock, and stayed additive alongside the in-flight `ai-models`
worktree.

- `lib/linkedin/publish.ts` — the share path plus the gate. **Two independent
  keys, neither turned:** `PRESTO_ENABLE_LIVE_PUBLISH` (absent, and deliberately
  *not* added to `.env.local.example` — it's an act, not configuration), and
  `w_member_social` in the connection's granted scope (never requested, so no
  stored token carries it). Checked in that order; not collapsed into one
  boolean, so flipping either alone is still a refusal.
- `parseGrantedScopes` splits on **both** commas and whitespace — FOLLOWUPS #5's
  trap: scopes are sent space-delimited and come back comma-delimited. Verified
  against the real row, which reads `email,openid,profile`.
- `postShare` is written against LinkedIn's versioned `rest/posts` API and is
  **unverified against a live call**, by construction. Commented as such: it's
  the starting point for the first real attempt, not known-good.
- `app/projects/[projectId]/generate/publish-actions.ts` — `publishPost`, beside
  the other post-level actions. Gated **before** the token is decrypted, so a
  refused publish never puts a plaintext token in memory; `publishTextPost`
  gates again before requesting. The duplication is the point.
- Two refusals that aren't about the gate: a **`is_tryout` post can never
  publish** (it borrows a real platform value, so without the check it would
  resolve to the user's genuine connection and post under their name), and a
  non-LinkedIn platform is refused outright.
- Nothing calls `publishPost`: no button, no cron, no `vercel.json`. `status:
  "published"` is written only on a real success, which is why nothing in the
  app has ever set it (see lib/dashboard-summary.ts).

**Verified.** `lib/linkedin/publish.test.ts` (15 tests) pins both keys, the
either-delimiter parsing, and — the property that actually matters — that a
refusal **makes no network call at all**, via a stubbed `fetch` asserted
uncalled. A gate that returned the right code *after* posting would pass every
other test and still have published. Also pinned: the switch opens only for the
exact string `"true"`. tsc clean, eslint clean on the three new files, 190/190
tests pass (`lib/ai/generate.test.ts` excluded from the run — FOLLOWUPS #12, it
spends live Gemini quota).

---

## 2026-08-31 — Connection revocation: a dead token stops reading green

Same branch, second task, and the one its slug actually names. Its `.worktree`
manifest carried a `PURPOSE` line all along — "surface LinkedIn token expiry
before it lapses and make reconnecting a first-class action, so a 60-day expiry
is visible and recoverable rather than a **silent 401**" — which I'd earlier
reported as "no brief recorded anywhere" after checking git, the project logs
and `worktree.sh list`, but not the manifest itself. The silent-401 half is
FOLLOWUPS #2 and is what this does.

**Schema slot claimed** (`SCHEMA=owned` in `.worktree`; `schema-owner` now
reports this branch). Both migrations are additive, so the in-flight
`ai-models` dev server is unaffected.

- Migration `add_social_accounts_status`: `status` ('active' | 'revoked',
  default 'active') mirroring `user_ai_models.status`, plus `last_checked_at`.
  A follow-up migration fixes that column's comment — the code stamps every
  *completed attempt*, including an indeterminate one, not only confirmations.
- `verifyLinkedInToken` (lib/linkedin/oauth.ts) asks `/v2/userinfo` — the
  cheapest call needing a token, and one the existing sign-in scopes already
  allow, so this works today with no scope change. **Fails open**: only an
  explicit 401 means revoked. A 429/5xx/dropped connection is "couldn't tell",
  same principle as `didFallBackOffByok`. 403 is deliberately excluded — that's
  an answer about the call, not a verdict on the token.
- `lib/linkedin/liveness.ts` holds the throttle (1h) and `isLivenessCheckDue`,
  imported by **both** the page and the action rather than duplicated. The
  server re-runs it as the authority, so a client with a stale copy can only
  reach our own server, never LinkedIn.
- `useConnectionLivenessCheck` (hooks/) runs after mount, never blocking a
  render, sequentially over accounts, with a ref of already-asked ids so the
  state update it causes can't re-trigger it. Acts only on a definite
  "revoked" — `null` (offline) and `error` both leave the row alone.
- `connectionStatus`/`isConnectionDead` (lib/format-date.ts) fold the two ways
  a connection dies into one treatment. **Expiry is checked first**: a lapsed
  *and* revoked token reads "expired", the reason a reader expects and one
  that's true whether or not a check ever ran.
- Every previous `expiryStatus` caller now goes through it — the row, the
  panel's "n connections active" badge, and the dashboard's setup checklist —
  so a revoked connection stops counting as active in all three.

**The bug this would have shipped with.** The OAuth callback upserts, and an
upsert only writes the columns it names — so reconnecting an account that had
been marked revoked would have kept `status = 'revoked'` against a brand-new
working token, leaving the row dead forever. The callback now resets `status`
and `last_checked_at` explicitly.

**Verified:** tsc clean, eslint clean on all seven touched files, 200/200 tests
(`lib/ai/generate.test.ts` excluded — FOLLOWUPS #12), `next build` compiles.
New tests: `lib/linkedin/liveness.test.ts` (throttle boundary, never-checked,
already-revoked, unparseable timestamp) and a `connectionStatus` block in
`lib/format-date.test.ts` (all four states, plus the lapsed-and-revoked
precedence).

**Browser verification was blocked at first, then done** — recorded because the
gap was real for a while. On 2026-08-31 the Claude-in-Chrome extension was
disconnected and the chrome-devtools browser is a fresh profile with no session,
so the visual treatment couldn't be seen; the row was restored to its true state
immediately and the gap logged. The user reconnected the extension on
2026-09-01 and it was verified in full on **:3002**:

- **Revoked treatment** (row forced to `revoked`, token still 54 days from
  expiry — exactly the case the column exists for): red `surface-danger` strip
  reading "Connection **revoked**" with the WarningDiamond, a green Reconnect,
  and **no countdown**, despite those 54 days. The badge read "No connections
  active", so a revoked row is excluded from the count.
- **Active treatment restored**: green strip, "Connected as Godwin John",
  Disconnect, "Expires in 54 days", badge "1 connection active".
- **The check firing for real**, which is the part unit tests can't reach:
  with `last_checked_at` reset to null, one page load took it to 18 seconds ago
  while `status` stayed `active` — i.e. the hook fired on mount, the action
  decrypted the stored token, and LinkedIn's `/v2/userinfo` answered 200.
- **The throttle**: a second load left that timestamp untouched, so no second
  call to LinkedIn.

The row was left `active` with a genuine `last_checked_at`, which is simply
where a real check leaves it. There is still no DOM test environment here (node
only; jsdom would be a new package), so the *automated* coverage remains the
unit tests on the pure predicates plus tsc on the wiring.

**Port note:** this worktree's manifest says 3003, but Next refused a second
dev server for the same directory and the one actually serving this code is on
**:3002** (3000 = main, 3001 = ai-models). Worth checking with `lsof` before
screenshotting anything here.

---

## 2026-09-01 — Disconnect's revoke path, exercised live at last

The last unexercised piece of the LinkedIn lifecycle (AGENTS.md had it as the
one path never run against the real API). Run at the user's request on their
own live connection.

**Method.** `disconnect` swallows every error by design — a failed decrypt or a
rejected revoke is silent — so the outcome at LinkedIn is the only observable.
The discriminator: LinkedIn skips the consent screen when a grant is live, and
shows it when the grant is gone. So *"does reconnecting prompt for
permission?"* answers *"did the revoke land?"*.

- Disconnect via the real UI: confirmation modal → row deleted (0 rows) → empty
  state restored, no error toast.
- Reconnect prompted the **full permission screen** (user-reported).
- **Control, run afterwards with the grant live and the browser signed in:**
  hitting the authorize leg again completed **silently** — same row id, but
  `connected_at` 13:47:07 → 13:53:20, so a real round trip that minted a new
  token and upserted in place rather than a no-op.

Live grant ⇒ silent; post-revoke ⇒ consent. **The revoke reaches LinkedIn.**
Confidence is strong rather than absolute: the user's recollection was hedged,
and that reconnect was also the first login in that browser profile. The
airtight version is disconnect-then-connect with a session already established.

**A real trap found, and it is not in the code — see LEARNINGS.** The first
reconnect attempt was made from this worktree (:3002) and died at LinkedIn's
own error page: *"The redirect_uri does not match the registered value"*.
`getLinkedInConfig` derives the redirect URI from the request origin, and only
`localhost:3000` is registered on the LinkedIn app, so **the connect leg only
works on :3000** whatever port you develop on. Nothing server-to-server is
affected (token exchange, userinfo, the liveness check, revoke are all plain
fetches), which is why the revocation work verified fine on :3002.

**Bonus confirmation of the migration's safety.** The reconnect ran through
:3000 — i.e. **main**, which predates the `status`/`last_checked_at` columns —
and wrote a valid row, the defaults filling in (`active`, null). Live proof the
additive migration is backward-compatible with the unmerged main checkout,
which is running right now.

## 2026-09-01 — Rework after /integrate blocked the branch

`main` merged in first (`feat/connection-expiry`: LinkedIn expiry/revocation and
the refused-by-default publish path), so everything below was fixed and measured
against what will actually merge.

### Authorization, for the record (review §5)

All seven packages and dropping the Vercel AI Gateway **were authorized by the
user**, in four exchanges. Recording it here so no future reviewer has to infer
it:

- **2026-08-29 — the gateway, `@ai-sdk/anthropic`, `@anthropic-ai/sdk`.** I laid
  out staying on the gateway vs. calling providers directly, said plainly that
  the direct option meant "one npm package per provider" and that it "needs your
  go-ahead — adding packages is on your 'ask first' list". The user replied
  **"start with anthropic"**. That is the authorization for both the stack change
  and the Anthropic pair.
- **2026-08-30 — `@ai-sdk/openai`, `openai`.** The user said **"now do for
  openAI"**. Worth being precise: I did *not* re-ask before installing, I named
  the two packages in the report afterwards. I read the instruction as
  authorization under the one-package-per-provider pattern already agreed above.
  Defensible, but a separate ask would have been better.
- **2026-08-30 — `unpdf`, `mammoth`.** The user said **"install the verified
  package and do your stuff"** — explicit, after I had described the PDF/DOCX
  extraction work and said it needed their go-ahead.
- **2026-08-31 — `@ai-sdk/groq`.** I listed the candidate free providers with
  their packages and recommended Groq; the user replied **"start with groq"**.

The AGENTS.md bullet claiming the gateway was chosen *because* it added no
package is now superseded by the corrected bullet in that file.

### The blocker: provider SDKs in the client bundle (review §1)

Reproduced before touching anything, on this branch with `main` merged:
`.next/static/chunks` **6.9 MB**, largest chunk **1,092,182 bytes**, 3 chunks
matching provider-SDK markers.

Fixed by extracting `lib/ai/model-constants.ts` — literals and types, **no
imports at all** — and repointing all eleven importers (five client components
plus six server/test files) at it. `generate.ts` deliberately does **not**
re-export them: one right answer beats a convenient shortcut back into the trap.
`GenerationFailureReason` moved too, since `failure-copy.ts` and
`generating-view.tsx` both read it from client-adjacent code.

Measured after, from a clean `.next`:

| | before | after |
|---|---|---|
| `.next/static/chunks` | 6.9 MB | **3.4 MB** |
| largest chunk | 1,092,182 B | **540,024 B** |
| chunks matching SDK markers | 3 | **0** |

Each marker individually (`dangerouslyAllowBrowser`, `anthropic-version`,
`x-api-key`, `api.groq.com`, `openai-organization`) is now 0.

**`lib/ai/no-client-sdk.test.ts` is the guard**, and it exists because *every
normal gate stayed green through the whole regression* — tsc, eslint, vitest and
`next build` cannot see a bundle boundary. It scans source for `"use client"`
modules importing a runtime value from `generate.ts`/`providers.ts`/
`extract-file-text.ts`, and asserts model-constants.ts still imports nothing.
Verified it actually fails: reintroducing the old `day-deck.tsx` import made it
fail naming that file, and it passed again on revert.

### §2 — the redirect bypass in fetch-url.ts

`PRIVATE_HOST` was checked against the typed URL while `fetch` followed
redirects itself, so a public URL 302-ing to `169.254.169.254` was fetched and
inlined with the guard never seeing the final hop — no DNS control needed.
Now `redirect: "manual"` with each `Location` re-checked before it is fetched,
capped at 5 hops, sharing one deadline across the chain so a loop can't reset
the clock. Three tests: the metadata redirect is refused *and never requested*,
an ordinary public redirect still resolves, and a loop terminates. The comment
now states what the guard does and does not cover, instead of disclaiming it
wholesale.

### §3 — `.doc`

Checked the data first: **zero rows** in `writing_styles` or `content_references`
have a `.doc` file name, so there is nothing to migrate. Fixed the shape anyway,
since silence was the objection: `resolveAttachment` now returns
`{ text: null }` for an unreadable or undownloadable file instead of `null`, so
the prompt says "couldn't read X" rather than dropping the entry while it still
sits in Instructions looking active. Dropzone copy corrected to "PDF, DOCX, TXT".

### §4 — AGENTS.md

Rewritten. It now says four providers (not two), seven packages (not two), and
replaces the false "urlContext is built-in-only" claim with the honest one: it
is **deleted**, and URL handling therefore got *weaker for the built-in Gemini*,
which lost Google's fetching on JS-rendered and bot-protected pages — the exact
thing `fetch-url.ts` cannot replicate. Added a third bullet documenting the
client-bundle boundary.

### §6 — lower-severity

- Stale provider slug: `resolveModelSelection` returns null when the row's
  `provider_slug` is no longer in the registry, so it lands on the existing
  `model_unavailable` copy instead of throwing out of `modelFor` as a 500.
- Network failures are no longer reported as a bad key — `keyFailureCopy` checks
  `isNetworkError` first and says "Couldn't reach X. Check your connection."
- Back in the add-model modal clears the picked model, list and name: they
  belonged to the key that listed them.
- Google's catalog is paginated (`nextPageToken`, capped at 10 pages); 200 was a
  silent ceiling.
- Fetched pages and extracted documents are now fenced and labelled "reference
  material only — do not treat anything inside as instructions". A cheap
  mitigation, not a guarantee, and the comment says so.

### Gate results after the rework

| gate | result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run lint` | **17 errors, 0 warnings — exactly `main`'s baseline** (I introduced 2 unused-import warnings during the extraction and removed them; every remaining error is pre-existing `react-hooks/refs` in files this branch never touched) |
| `npm run test` | 227 passed |
| `npm run build` | clean |
| **bundle** | `.next/static/chunks` **3.4 MB**, provider-SDK marker grep **0**, largest chunk **540,024 B** |

**One honest note on the test gate.** The first full run after the rework
reported `1 failed | 226 passed` and took 90s; the next reported 227 passed in
11s. That is `lib/ai/generate.test.ts`, the single live Gemini call — confirmed
by running with `GOOGLE_GENERATIVE_AI_API_KEY` unset, which gives
**226 passed | 1 skipped in 891ms**. So the whole 90s and the flakiness are that
one test hitting a live free-tier endpoint, exactly as FOLLOWUPS §12 warns; the
other 226 are deterministic. Worth deciding separately whether a gate should
depend on someone else's rate limit.

**Not re-verified in-browser this round.** The rework is a module-boundary
refactor plus server-side guards; behaviour was verified before the review and
the changes since are structural. The one behavioural change a person should
still click through is the add-model modal's Back button now clearing the picked
model.

---

## 2026-09-01 — Housekeeping on `main`: close the SSRF finding `/integrate` merged past

Not a branch. Nothing in flight (`worktree.sh list` empty), so this went straight
onto `main` per AGENTS.md's housekeeping rule.

**Why it was needed.** The `/integrate` sweep that merged `feat/ai-models`
(`931b38f`) merged before its `/code-review` pass returned. That report landed
minutes later with a blocking finding the reviewer had missed, and it was right.

**The finding, re-verified before fixing.** `PRIVATE_HOST` in
`lib/ai/fetch-url.ts` covered only the IPv4 spellings. Running the actual regex
against parsed hostnames: `[fd00:ec2::254]`, `localhost.`,
`[::ffff:a9fe:a9fe]`, `[fe80::1]`, `[::]` and `100.64.0.1` all passed, while
`169.254.169.254` / `localhost` / `[::1]` / `127.0.0.1` were blocked — so the
guard looked correct from the cases anyone would try first. These are private
address *literals*, which is exactly what the guard claimed to cover; the file's
documented gap was only about hostnames that *resolve* privately. Reachable both
from a pasted URL entry and from a redirect off a public page — the case the
per-hop re-check in the same branch was added to defend.

**Done.** Replaced the regex with an `isPrivateHost` predicate (normalize →
IPv4 prefixes → IPv6 `::`/`::1`/`fc00::/7`/`fe80::/10` → v4-mapped forms tested
as the IPv4 address they reach). Exported it and added a 20-case table test, both
directions. `isFetchableUrl` is the only caller and every redirect hop already
goes through it, so both entry points are covered by the one change. See
LEARNINGS.md for the shape of the mistake.

**Also cleared:** two worktree husks left at `../presto-worktrees/` by
`worktree.sh remove` failing on its own `.next` artifacts (`ai-models`, 235 MB,
already deregistered from git; `connection-expiry`, 40 KB, `.next` only, no
`.git`). `git worktree list` showed only the main checkout before and after.
`../presto-worktrees/` is now empty. The `ai-models` husk would otherwise have
blocked a future `/branch ai-models`.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run lint` | 17 errors — exactly `main`'s baseline (all pre-existing `react-hooks/refs` in untouched files) |
| `npm run test` | 246 passed / 22 files, **excluding `lib/ai/generate.test.ts`** |
| `npm run build` | clean |

**On the excluded test:** FOLLOWUPS §12 — that file makes a live Gemini call and
`.env.local` is injected into vitest, so a plain run spends free-tier quota and
takes ~90s. This change is confined to `fetch-url.ts` and touches no generation
path, so it was excluded deliberately rather than skipped by accident. Ran on
its own, `lib/ai/fetch-url.test.ts` is 33 passed.

**Left alone deliberately:** `feat/ai-models` still exists locally. It is fully
merged and spent, but it is also the only unwind path back to `66e6dd1` while
`main` is unpushed, so deleting it is the user's call, not housekeeping.

---

## 2026-09-01 — "Model added" toast + newest-first model list (main, housekeeping)

Direct request, nothing in flight (`worktree.sh list` reported main only), so
edited `main` per AGENTS.md's housekeeping exception. One file:
`components/settings/ai-models-panel.tsx`.

1. **Success toast.** The panel already had a toast, hardcoded to `danger` for
   the failed-delete path. Added a `toastVariant` state alongside the existing
   message/open pair rather than a second `<Toast>` — the two can't overlap
   (you can't delete a row while the add modal is open) and one slot keeps the
   `ToastSlot` portal single. `handleAdded` sets "Model added" / `success`.
2. **Newest first.** `sortByCreatedAt` (ascending) became `sortNewestFirst`
   (descending), applied to `initial` via a lazy `useState` initializer as well
   as to the failed-delete reinsert, so a reload reads the same way as the
   moment after an add. `handleAdded` prepends. **Deliberately scoped to the
   panel** — `fetchUserAiModels` keeps its ascending `order()` because the
   Generate page's model pill reads the same query, and a picker's option order
   shouldn't shuffle because you added a key on another screen.
3. **Scroll-to-top on add.** The tray is `max-h-38 overflow-y-auto`, so with 3+
   models a new row at the top can land out of view. Composed a plain node ref
   with the squircle hook's callback ref (`setListRef`) and `scrollTo({top:0})`
   *before* the `setModels` call — at offset 0 an insertion above the viewport
   doesn't get scroll-anchored back down.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` (changed file) | clean |
| `vitest run` | 247 passed / 23 files |
| `npm run build` | clean |

Not verified in-browser — the add flow needs a real provider API key.

### Follow-up, same day: no tick on the success toast, and no already-added models in the picker

1. **`showIcon={toastVariant !== "success"}`** on the panel's toast. The prop
   already existed; the danger case keeps its icon.
2. **`AddModelModal` takes `existingModelIds`** and filters the catalog with it
   (`availableModels`, derived at render rather than filtered into `models` at
   fetch time, so a delete while the dialog is open puts the option back). The
   panel passes `models.map(m => m.gatewayModelId)` — the same column the
   `(user_id, gateway_model_id)` unique constraint is on, which is what the
   "You've already added that model." error was reporting. That server check
   stays as a backstop; it just isn't reachable through the UI any more.
   When a key's whole catalog is already added, stage 2 replaces the combobox
   and Name field with a line saying so — Back is the way out.

Gates: tsc clean, eslint clean on both files, vitest 247/23, build clean.
Note: `npx prettier --write` on this repo adds semicolons the codebase doesn't
use — reverted and reapplied by hand. Don't run it here.

### Follow-up: a key check that outlived its dialog

Reported: set a provider + key, hit Continue, close the dialog while it's
checking — reopening lands on stage 2 (the model list), and saving from there
returns "Pick a model and give it a name before saving."

**One bug, not two.** `reset()` runs on close and empties the form, but the
`listGatewayModels` promise was still in flight; when it resolved it ran
`setModels(...)` / `setStage("model")` against the freshly-reset state. So the
next open showed the model list with `providerSlug` and `apiKey` both `""` —
and `addModelSchema`'s `min(1)` on those two is exactly what produced the save
error the user couldn't place. Fixing the first removes the second.

Fix: a `requestIdRef` stamped at the start of `handleContinue` and bumped by
`reset()` (i.e. every close), by a subsequent check, and by Back. A superseded
response returns before touching any state — including `verifying`, which
whatever bumped the id now owns; `reset()` clears it. A server action can't be
aborted, so this discards the result rather than the request, which is the half
that was observable.

Also belt-and-braces: Save is disabled without `providerSlug`/`apiKey`, not
just without a model, so no residual path can reach that validation message.

Gates: tsc clean, eslint clean, vitest 247/23, build clean. Not verified
in-browser — reproducing it needs a real provider key.

---

## 2026-09-01 — `publish-state` on `main`: published becomes a recorded fact

Done on `main` at the user's explicit direction, with nothing in flight. Worth
noting it is **not** housekeeping by AGENTS.md's definition — a migration plus
hot files (`types/post.ts`, `lib/content-grouping.ts`, `lib/dashboard-summary.ts`)
is exactly the case that rule says should be a branch. Flagged before starting;
the user's call. Full branch gates were run regardless.

**The question that started it.** "How do you decide publish for both Twitter
(X) and LinkedIn since both appear in Content's published?" The answer was that
nothing decided it. `belongsToTab` read `scheduledFor < now`, platform was never
consulted, and the live DB had **306 posts: 76 showing as Published, 0 ever
published**.

**Model.** A post has exactly one `platform`, so there is no fan-out to
reconcile — publishing is one attempt at one place. Migration
`add_posts_publish_state` (additive, all-nullable) adds `published_at`,
`provider_post_id`, `publish_started_at`, `publish_error`, plus a check
constraint that a published post must carry a provider id — the pair that keeps
`published_at` trustworthy.

**Tabs.** `belongsToTab` is now total and disjoint on the post alone: published
= `publishedAt` set; draft = no date and never published; queued = has a date
and not published, *including a date already past*. An overdue post staying in
Queued is the honest answer — it is still waiting and nothing has sent it. New
`isOverdue` / `hasFailed` predicates say so; **their UI belongs with the branch
that makes failure possible**, and is deliberately not built here.

**`now` is gone from the whole chain** (`belongsToTab`, `postsForTab`,
`dayKeyForPost`, `groupPostsByMonth`, `totalsByState`). Which tab a post is on is
a property of the post, so it no longer moves with the clock — which also
retired the once-per-request timestamp threaded down from `calendar/page.tsx`
and its `react-hooks/purity` exception, a hydration hazard that existed only to
serve the old rule.

**Two drifts closed while in there.** `totalsByState` had its own copy of the
split and now calls `belongsToTab`. Grouping and sorting within a tab had
already diverged — Published grouped by the day it went out, sorted by when it
was due — so both now read one `groupingTimestamp`.

**Publish action.** Both findings the reviewer flagged are fixed. The post
lookup is scoped `.eq("project_id")` as well as `.eq("id")` (RLS scopes to the
user, but one user owns several projects, so id alone would publish project A's
post through project B's connection). Idempotency is a **claim inside the
update** — `.is("published_at", null)` plus a 5-minute stale window, returning
the row — not a read-then-write, which leaves both requests believing they won.
Success writes `published_at` + `provider_post_id` together; failure releases
the claim and records `publish_error`.

**Effect on the live data**, before/after, same 306 rows:

| | before | after |
|---|---|---|
| Published | 76 | **0** |
| Queued | 88 | **164** (76 of them overdue) |
| Draft | 142 | 142 |

Published reading zero is the correct answer and the whole point: nothing has
ever been published. The 76 are pre-publishing test posts whose dates passed.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run lint` | 17 errors — exactly `main`'s baseline |
| `npm run test` | 253 passed / 22 files, excluding `lib/ai/generate.test.ts` (FOLLOWUPS §12, live Gemini quota) |
| `npm run build` | clean |

**Not done here, on purpose:** the overdue/failed card treatment, and anything
that makes `posts.status` disappear — it is vestigial now and marked as such in
`types/post.ts`, but dropping a column is not additive and no branch should own
that while others are in flight.

---

## 2026-09-02 — `feat/linkedin-publish`: the reconnect state that has to exist before the scope flip

**Task.** Publishing itself is built and gated on `main` (`lib/linkedin/publish.ts`,
`publish-actions.ts`). The one un-taken step is requesting `w_member_social`.
Per LinkedIn, requesting a different scope than the one previously granted
invalidates every access token already issued — so the flip is a *migration*,
and the user's call was: **build the reconnect UX first, flip the scope after.**
This entry is the first half. `LINKEDIN_SCOPES` is unchanged.

1. **`lib/linkedin/scopes.ts` (new).** `LINKEDIN_SCOPES` moved here out of
   `oauth.ts`, and `parseGrantedScopes` out of `publish.ts`. Both of those
   modules are server-only at runtime — one reads the client secret, the other
   makes the share call — and the Connections page is a client component that
   now needs to read the scope list. Same trap as `lib/ai/model-constants.ts`:
   a client importing either would pull it into the bundle. The new module is
   pure and imports nothing.
2. **`grantIsCurrent(raw)`** is the predicate: does a stored grant still cover
   everything `LINKEDIN_SCOPES` asks for. Deliberately *not* "does it have
   `w_member_social`" — asked against the list, the UI needs no edit when the
   list changes, and no connection is ever prompted for a scope we don't
   request. Today it is true for every row; the moment a scope is added it goes
   false for every row granted under the old list, which is the migration
   catching itself.
3. **`scope` is now on `ConnectedSocialAccount`** (types/social-account.ts) and
   in `fetchSocialAccounts`'s select. Not a secret — unlike
   `encrypted_access_token`, which stays out of every select that can reach a
   browser.
4. **`connected-account-row.tsx`** gained a fifth case. It is *not* a fifth
   `ConnectionStatus`: staleness is orthogonal to liveness (the token still
   works for what it was granted), so folding it into that enum would have
   invented a precedence puzzle with expiry and revocation. It's a flag,
   `grantIsStale`, and it keeps the green block and swaps the countdown's chip.
   `RenewChip` generalised to `ReconnectChip` (label + tooltip as props) —
   both states are the same authorize redirect and differ only in why they ask.
   One chip, never two: a stale grant wins over the expiry warning, because
   renewing a token that already works reads as optional and this doesn't.
5. **Tests.** `lib/linkedin/scopes.test.ts` — the delimiter cases moved over
   from publish.test.ts, plus `grantIsCurrent`: a superset grant passes, any
   missing requested scope fails, and the simulated add-a-scope case (the row
   granted under `LINKEDIN_SCOPES.slice(0, -1)`) fails without naming which
   scope was added. `publish.test.ts` keeps the two cases about the publish
   scope itself. `post-account.test.ts`'s factory carries the new field.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` (changed files) | clean |
| `vitest` | 259 passed / 24 files |

**Not verified in-browser.** The chip cannot render until a scope is added, so
seeing it means temporarily extending `LINKEDIN_SCOPES` with a probe value and
reloading Connections. Both the edit and creating a browser tab were denied by
the sandbox this session, so the UI state is unverified — the predicate and the
wiring are covered by tests, the rendering is not.

**Still to do on this branch, in order:** register the *Share on LinkedIn*
product on the LinkedIn app (without it the authorize leg dies with
`unauthorized_scope_error`); add `w_member_social` to `LINKEDIN_SCOPES` and
invert `oauth.test.ts`'s absence assertion; reconnect **on :3000** (the only
registered redirect URI — see LEARNINGS) and confirm the consent screen names
posting and the exchange returns the scope. `PRESTO_ENABLE_LIVE_PUBLISH` stays
unset throughout: an actual live post is a separate green-light.

### Same task, second half — the scope flip itself

The *Share on LinkedIn* product turned out to be already added to the LinkedIn
app, which was the only thing I'd named as blocking. So, per the sequencing the
user chose (reconnect UX first, flip after), the flip went in the same session.

6. **`w_member_social` is now requested.** `LINKEDIN_PUBLISH_SCOPE` moved from
   `publish.ts` into `scopes.ts` (the one place that decides what's requested
   should be the place that names it; `publish.ts` re-exports it, so the
   publish path still reads as self-contained) and joined `LINKEDIN_SCOPES`.
   **`PRESTO_ENABLE_LIVE_PUBLISH` is untouched and still unset** — the gate's
   first key refuses every publish regardless, and AGENTS.md's constraint is
   unchanged: holding the permission is not using it.
7. **The guard test moved rather than went away.** `oauth.test.ts`'s "asks for
   sign-in scopes only" — which pinned the scope's *absence* — is now "asks for
   the scopes the app declares", asserting the URL matches `LINKEDIN_SCOPES`
   exactly, so a scope still can't reach an authorization request without being
   declared first. What stops a live post is `checkPublishGate`, pinned in
   publish.test.ts, and that is untouched.
8. **A test I'd written an hour earlier failed, correctly.** `grantIsCurrent`'s
   "accepts what a live connection actually carries" case asserted that
   `email,openid,profile` is current — true when written, false the moment the
   scope was added. It's now "rejects the sign-in-only grant every
   pre-2026-09-02 connection carries", which is the migration stated as an
   assertion. The scope-agnostic case (`LINKEDIN_SCOPES.slice(0, -1)`) stays,
   so the predicate is still pinned for the *next* time the list changes.

**Verified in-browser** (:3002, the worktree's own port — rendering only, no
OAuth leg, which needs :3000): the real LinkedIn connection now renders the
stale treatment — green block, "Connected as Godwin John", "Expires in 59 days"
still in subtle grey (it isn't expiring), and a "Reconnect" chip where the
"Renew now" chip would sit. The "1 connection active" badge still counts it,
which is right: it's alive, it just can't post.

**One thing the screenshot caught that the tests couldn't**: the first tooltip
copy ("This connection was set up before Presto asked for these permissions.
Reconnect to grant them.") rendered as a single ~460px line across a 312px row,
laying a bar over the green strip it was annotating. Shortened to "Reconnect to
grant Presto permission to post", matching the Renew chip's tooltip length.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` (changed files) | clean |
| `vitest` | 259 passed / 23 files; `lib/ai/generate.test.ts` times out on live Gemini quota, as on `main` (FOLLOWUPS §12) |

**Left for you:** reconnect the account **on :3000** — the only registered
redirect URI — and confirm the consent screen names posting and the row's chip
clears itself. Until then the connection keeps working for everything except
publishing, which is refused twice over anyway.

### Verified live, 2026-09-02 15:30 UTC

The user reconnected and was shown a consent screen asking to grant the app
permission — which is the tell that the new scope was actually requested, since
LinkedIn skips consent for a re-authorisation that asks for nothing new.

| | before | after |
|---|---|---|
| `scope` | `email,openid,profile` | `email,openid,profile,w_member_social` |
| `connected_at` | 2026-09-01 13:53 | 2026-09-02 15:30 |
| `expires_at` | 2026-10-31 | 2026-11-01 |

The delimiter is comma, as documented — the value is stored verbatim and
`parseGrantedScopes` handles both, so nothing depended on which one came back.
The connected row cleared itself: no chip, "Expires in 60 days" in subtle grey.
`grantIsCurrent` is now true for the only row in the table, which is the
migration completing.

**Two false starts worth recording**, both from the same wrong assumption:

- I reported ":3000 is the main checkout, so the flip isn't live there". It is
  not — **:3000 was being served by this worktree's own dev server** (`Dir:`
  in the "Another next dev server is already running" error names this
  directory), which is also why `next dev -p 3002` refused to start a second
  one. The flip was live on :3000 the whole time. Check the running server's
  `Dir:`, not the port, before reasoning about which branch a page is serving.
- An earlier reconnect attempt left the row untouched — same `connected_at` to
  the millisecond. The callback rewrites `scope`/`connected_at`/`expires_at` on
  every upsert, so an unchanged row is proof the flow never reached the
  callback, and a *partially* updated row would mean something else entirely.
  That triple is the cheapest way to tell "didn't run" from "ran and failed".

**The gate is unchanged and still shut.** With the scope now granted,
`checkPublishGate` refuses on key 1 (`publishing_disabled`) rather than key 2 —
`PRESTO_ENABLE_LIVE_PUBLISH` is unset, nothing calls `publishPost`, and turning
that key is a separate green-light per AGENTS.md.

### Publish trigger, part 1 — the predicate, the menu row, the deck

Green-lit to build the whole path: trigger, failure states, scheduler, and one
real live post. `PRESTO_ENABLE_LIVE_PUBLISH` stays unset until that last step.

1. **`lib/post-publish.ts`** — `canAttemptPublish` / `publishBlockedReason`, one
   predicate for three surfaces (menu, post page, and the scheduler later), so a
   control can't appear in one place and not another. Mirrors `publishPost`'s
   own refusals for the things a client can see: already published (checked
   first — the only state where offering the control could produce a *second*
   live post), try-out, unsupported platform, platform not connected.
   **Deliberately blind to the gate**: `PRESTO_ENABLE_LIVE_PUBLISH` and the
   granted scope are server-only, and hiding the control when publishing is off
   would make a refusal invisible rather than explained. An expired or revoked
   connection still gets the control, because "reconnect it and try again" is
   more useful than a missing button. Pinned by lib/post-publish.test.ts.
2. **`PostActionsMenu`** gained an optional `onPublish` — "Publish now",
   PaperPlaneTilt, first row, dividers recomputed from what's actually above.
   `GeneratedPostCard` passes it through and now renders a menu when
   `date || onOpen || onPublish`. The Generating page passes nothing: a post
   written seconds ago hasn't been read yet, let alone approved.
3. **`publishPost` returns `publishedAt`** alongside the URN. The caller patches
   its own copy with it; a client stamping its own `new Date()` would disagree
   with the row by the round trip, which at a day boundary files the post under
   the wrong day on the Content page.
4. **The day deck** wires it: `ConfirmationModal` (publishing is the one action
   here that is irreversible *and* public, and the copy names the account it
   goes out as), then an **awaited** call — not the optimistic shape every other
   action here uses, because flying the card home on a hope would show
   "published" for a post that never went out. On success the post leaves the
   Queued tab for Published, so it departs through the same `leaveDeck` flight
   as a date change, asked through `keyForPost` rather than assumed. On failure
   the action's own sentence is shown as-is (the gate, an expired connection and
   LinkedIn refusing are different problems with different fixes) and
   `publishError` is mirrored locally so the failed treatment turns on without a
   refetch. The deck's toast gained a `success` variant for this.

tsc clean; eslint clean on the touched files (the 10 remaining errors are
`main`'s own baseline in generate-calendar-column.tsx / generating-view.tsx).

### Publish trigger, part 2 — the post's own page, and a bug the browser caught

5. **post-details.tsx** gets the same control: a `success`-green PaperPlaneTilt
   leading the action row (Regenerate already owns `brand`, and the two must not
   read as the same weight when one is irreversible and public), its own
   `ConfirmationModal` naming the account, and an awaited send.
6. **A published post can no longer be regenerated or moved back to drafts.**
   Once it is live, LinkedIn owns the copy people are reading and nothing here
   can change or recall it — so the two actions that would make this screen lie
   are disabled, each saying why in its tooltip. Delete stays, with its own copy
   for that case: it removes Presto's record, the live post survives.
7. **The refusal path, verified in-browser on :3000** — the whole point of
   building it before the key is turned. Publish → confirm → danger toast
   "Publishing to a live account is switched off for this app.", and the row
   afterwards: `published_at`, `publish_started_at` and `publish_error` all
   still null. The gate refuses before the claim *and* before the token is
   decrypted, so nothing was sent and nothing was written.
8. **That screenshot caught a real bug in the handler**, which tests would not
   have: both clients patched `publishError` on *any* error, including a
   refusal the server never recorded — so a post the database considers
   untouched would have shown the failed treatment until the next refetch.
   `publishPost` now returns `recorded: true` only on the branch that actually
   wrote `publish_error` (an attempt that reached LinkedIn), plus the `failure`
   code, and both call sites mirror only that. **A refusal and a failed attempt
   are different states and the client cannot tell them apart from a string** —
   which is the general lesson, and why the action returns a code at all.

### Overdue and failed, said on the card

`isOverdue` and `hasFailed` have had tests since the publishing schema landed
and nothing rendered them: a post whose date slid past looked exactly like one
due next Tuesday, and one LinkedIn refused looked exactly like one nothing had
tried yet.

9. **`components/content/post-status-marker.tsx`** — one marker, three surfaces
   (Kanban card, deck card, post page). **Failed outranks overdue** and they are
   never both shown: a failed post is past its moment by definition, but "we
   tried and LinkedIn said no" is the fact that explains the other one and the
   one with something to do about it. No Figma export draws either state (the
   content exports predate publishing), so it is composed from tokens.
10. **`lib/clock.ts`, and why it exists.** Only the overdue half needs a clock,
    and the Content page deliberately *stopped* threading a `now` down when tab
    membership stopped depending on it (see calendar/page.tsx) — re-introducing
    the prop would have brought back the `react-hooks/purity` exception it
    dropped, through MonthBoard and KanbanColumn, neither of which otherwise
    cares. So: a module store on a 60s tick read through
    `useSyncExternalStore`, same shape as network-status and section-navigation.
    Its **server snapshot is 0**, so nothing is overdue during the server render
    and the marker resolves on hydration; the cached snapshot is what keeps
    useSyncExternalStore from looping, and the interval only runs while
    something is subscribed. Pinned by lib/clock.test.ts.
11. **`lib/publish-failure.ts`** — the failure copy moved out of
    publish-actions.ts so the server's toast and the card's own treatment can't
    describe the same failure differently, and so a client can read it without
    dragging the share call into the bundle. `publishFailureMessage` degrades a
    code it doesn't recognise (the column has no constraint, and a row could
    carry one from an older build) to something true rather than "undefined".
12. **`GeneratedPostCard` takes a `statusMarker` slot**, not a `post`: that card
    takes resolved primitives (`account` is resolved by its caller too), and the
    deck is the only caller with a whole Post to hand. The Generating page
    passes nothing, which is right — a post written seconds ago is neither.

**Verified in-browser on :3000.** Overdue: opened 1 July's deck (a past day) —
the card shows an amber "Overdue" at the head of its account row. Failed: set
`publish_error = 'token_expired'` on that one post, confirmed the post page
reads "**Didn't send** — That connection has expired. Reconnect it and try
again." on its own line above the pill, with the failed marker winning over the
overdue one on a post that is both — then **set the column straight back to
null** (confirmed: `publish_error`, `published_at`, `publish_started_at` all
null again). No other row was touched.

**A false alarm worth writing down**: the first screenshot of the Content page
showed the Kanban view with no markers, which read as a bug. It was the
documented pre-hydration frame — the stored "Show as" value can't be known until
hydration, so Kanban renders for a frame on a project saved as Calendar. The
markers were absent because the board wasn't mounted, not because they failed.
Check `document.body.innerText` before concluding anything from a first paint.

tsc clean; eslint clean on the touched files; vitest 271 passed (the one failure
is lib/ai/generate.test.ts's live Gemini quota, as on `main`).

### The scheduler — built, not armed

The user's rule, verbatim: *"don't publish anything overdue. let the scheduler
run on posts for the future. the user should either change date on overdue posts
to the future or publish manually."* Transport: Supabase pg_cron.

13. **`lib/publish-runner.ts` — one implementation of "publish this post".**
    Extracted from publish-actions.ts, which is now a 97-line wrapper around it.
    The two callers arrive completely differently — the button as the signed-in
    user through a server action, the cron as *nobody*, on a service-role client
    — but everything after "which post" is identical, and it is the part that
    must not be duplicated: the claim is what stops a post going out twice, and
    a second copy that drifts by one condition is a double post on a real
    timeline. It takes the Supabase client rather than making one, which is what
    lets it serve both, and it does **no access control of its own** beyond
    scoping every query to `(id, project_id)` — stated at the top of the file,
    because handed a service-role client it will publish whatever it is pointed
    at.
14. **`lib/publish-due.ts` — the backlog rule, and why it isn't "publish what's
    due".** 60 posts were already past their date, the oldest by two months; a
    scheduler that sent what was due would have put all 60 on a real timeline
    the moment it was armed. But "not overdue" can't mean "exactly now" either,
    or a tick that sees a post 40 seconds late sends nothing, ever. So: a
    **grace window** of 3 ticks (15 min at a 5-min cadence) — long enough to
    survive two missed runs, short enough that nothing surprising goes out — and
    anything older is backlog, permanently, by design. Plus a **batch cap of 5**,
    which is a bound on the blast radius of any mistake in that arithmetic.
    Pinned by lib/publish-due.test.ts, including the real 30 June date.
15. **`lib/supabase/service.ts`** — the first use of `SUPABASE_SERVICE_ROLE_KEY`,
    which has sat declared and unused in `.env.local.example` since the AI-models
    work. It bypasses RLS entirely, so the file carries the three rules for
    touching it and the cron's `where` clause is written as the security
    boundary it now is. FOLLOWUPS #3 argued against reaching for service role
    casually; this is the case it wasn't arguing about — there is no session to
    scope to and no user to ask.
16. **`app/api/cron/publish/route.ts`** — Bearer `CRON_SECRET`, **refusing
    outright when the secret is unset** rather than running open (a missing
    secret is a deployment mistake, and the safe reading is "nobody may run
    this"). Both failures return an indistinguishable 404. Selection excludes
    `publish_error is not null`: a failed post is never retried on its own,
    since retrying blind is how one broken connection becomes a stream of
    failures — it wears the "Didn't send" marker until a person decides.
    Sequential, not `Promise.all`: one account, one rate limit, and the ordering
    the query just established is worth keeping. Returns a JSON run summary
    (window, due, published, failed, per-post outcome).

**It is a dry run in its current state**, and deliberately: every send goes
through the same `checkPublishGate`, so with `PRESTO_ENABLE_LIVE_PUBLISH` unset
the endpoint reports what it *would* have sent and sends nothing.

**Blocked on two things, both the user's:** `SUPABASE_SERVICE_ROLE_KEY` is not
set in `.env.local` (only the example lists it), and the dev server has been up
since 13:00 so it hasn't loaded the `CRON_SECRET` this branch added. Confirmed
the route itself is live and refusing correctly: the response body is this
handler's own `{"error":"Not found"}` JSON, not Next's HTML 404.

**Not applied: the pg_cron schedule.** `feat/x-connect` holds the schema lock
(`./scripts/worktree.sh schema-owner`), and this touches the shared remote
project. The SQL, for when the lock frees:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('presto-publish-due', '* * * * *', $$
  select net.http_get(
    url := '<deployed origin>/api/cron/publish',
    headers := jsonb_build_object('Authorization', 'Bearer ' || '<CRON_SECRET>')
  );
$$);
```

Note it must point at a **deployed** origin — Postgres cannot reach localhost,
so the schedule is only meaningful once this is deployed. Locally the endpoint
is exercised with curl, which is how the dry run below was run.

tsc clean; eslint clean on the new files; vitest 281 passed across lib/.

### Cadence: one minute, and grace pinned apart from it

Per direct decision after talking through event-driven alternatives.

**Why not fire a job per post at its exact time.** pg_cron's syntax has no year
field, so "09:30 on 3 September" recurs annually and each job has to unschedule
itself; an external delayed-message scheduler (QStash, Inngest) does it properly
but is a new third-party dependency. Both share the real objection: they add a
second source of truth that must track every date change, draft toggle and
delete — four write paths — and their failure mode is **"silently never sent"**,
where polling's is "a few seconds late". Polling asks the database what is true
right now, so an edit needs no coordination at all.

- `PUBLISH_TICK_MINUTES` 5 → **1**. A post scheduled for 09:00 goes out by
  09:01. 1,440 runs a day, each one query returning nothing on almost all of
  them.
- `PUBLISH_GRACE_MINUTES` is now **its own constant at 15**, not `tick * 3`.
  That derivation quietly tied the safety margin to the cadence: dropping the
  tick would have shrunk grace from 15 minutes to 3, and a four-minute deploy
  would then strand a post in the backlog permanently. The two numbers answer
  different questions — how precise, and how forgiving. A test pins them apart.

**Still outstanding, and now more relevant:** `posts` has **no index on
`scheduled_for`** — only `posts_pkey` and `posts_project_id_idx`. At one query a
minute that wants a partial index (`where published_at is null`). Additive, but
it is the shared remote database and `feat/x-connect` holds the schema lock;
FOLLOWUPS #4 already collects index work for when nothing is in flight.

### The first live post — `postShare` verified, 2026-09-03 05:35 UTC

`lib/linkedin/publish.ts` carried a standing caveat: the request shape was
"**unverified against a live call** — by construction, since nothing has ever
been allowed to make one. Treat it as the starting point for the first real
attempt, not as known-good." That is now resolved.

**Process, since this is the one irreversible thing in the app.** Picked a
127-character *draft* (dateless, so it also exercised the draft→Published path),
showed the user its exact text, and got explicit confirmation on that specific
content before arming anything. Then: added `PRESTO_ENABLE_LIVE_PUBLISH=true` to
.env.local, user restarted the dev server, pressed Publish through the real UI,
and removed the key immediately afterwards.

**The request shape was right first time.** No changes to `postShare` were
needed: `rest/posts` with `LinkedIn-Version: 202608`, commentary-only,
`PUBLIC` / `MAIN_FEED`, `lifecycleState: PUBLISHED`, and the post's URN read off
the `x-restli-id` response header (the body is empty on a 201).

| | |
|---|---|
| `provider_post_id` | `urn:li:share:7501150776556412931` |
| `published_at` | 2026-09-03 05:35:07 UTC |
| `publish_started_at` | null — claim released |
| `publish_error` | null |
| `scheduled_for` | still null |

**What it confirmed beyond the API call**, all in one send: the success toast;
the publish control disappearing and Regenerate / Add-to-calendar going disabled
on a live post; the claim being taken and released; and — the one that could
only be checked with a real published draft — a dateless post landing on the
**Published tab under today** rather than vanishing, via `groupingTimestamp`'s
`publishedAt ?? scheduledFor ?? createdAt`.

**The gate is out of .env.local but the running server still holds it in memory**
until it is restarted: env is read at startup. Until that restart, :3000 can
still publish.

**Deliberately not exercised:** the cron endpoint while armed. With the gate open
it would have sent anything that came due in the previous 15 minutes, which was
not what the user confirmed. The sandbox blocked that curl on its own, which was
the right call.

### The scheduler published a post on its own, 2026-09-03 05:50 UTC

The last unobserved behaviour: a post going out *because its time arrived*
rather than because someone clicked. Confirmed with the user on the specific
content first, as with the manual send.

Setup: a draft was given `scheduled_for = now() + 2 minutes` (SQL, so the moment
was exact), the gate was armed, the dev server restarted to load it, and — since
pg_cron cannot reach localhost — one tick was fired by hand with curl. Before
firing, the window was checked: **1.2 minutes past due, and exactly one post
inside the 15-minute window**, so the tick could not take anything else with it.

The run summary, verbatim:

```json
{"ranAt":"2026-09-03T05:50:52.020Z","livePublishEnabled":true,
 "window":{"from":"05:35:52Z","to":"05:50:52Z","graceMinutes":15},
 "due":1,"published":1,"failed":0,
 "results":[{"postId":"bf73f2f0…","ok":true,"postUrn":"urn:li:share:7501154742442684416"}]}
```

The row afterwards: `status` published, `published_at` 05:50:52, the URN stored,
the claim released, no error, and `scheduled_for` **kept** — a scheduled post
keeps the date it was scheduled for, unlike the manual draft send which stays
dateless. The gate was removed from .env.local immediately after.

**What this closes.** Every path through publishing has now been exercised
against the live API: the refusal (gate shut), the manual send, and the
scheduled send. The service-role client, the due window, the batch query and the
claim all ran for real. What remains untested is only what cannot be tested from
a laptop — pg_cron itself, which needs a deployed origin.

Note the same restart tax applies as before: `.env.local` is clean, but a
running server keeps the old env until it is restarted.
## 2026-09-02 — feat/x-connect: X (Twitter) OAuth, protocol + token layers

Branch `feat/x-connect`, worktree port 3003, holds the schema lock. Building the
X connect flow as a sibling of LinkedIn's, not a generalization of it.

1. **Surveyed the overlap with `feat/linkedin-publish`** (live in the other
   worktree) before starting, because the plan initially called for serializing
   the two. It doesn't need to: publishing lives in
   `generate/publish-actions.ts` + `lib/linkedin/publish.ts`, connecting lives in
   `components/connections/*` + `app/api/connections/*`. The only shared file is
   `lib/supabase/queries.ts`, and in different functions. Both branches run
   concurrently.

2. **Two migrations** (additive, nullable, so the other worktree's server and
   every existing LinkedIn row are untouched):
   - `add_social_accounts_refresh_columns` — `encrypted_refresh_token`,
     `account_handle`, `refresh_expires_at`.
   - `add_social_accounts_refresh_claim` — `refresh_started_at`.

3. **`lib/x/oauth.ts`** — the protocol. PKCE pair generation (mandatory on X,
   not defence in depth), authorization URL, token exchange, refresh, profile
   read, revoke. Scopes are `users.read tweet.read offline.access`;
   `tweet.write` is absent and a test pins that.

4. **`lib/x/token.ts`** — the part LinkedIn has no equivalent of. X access
   tokens last 2 hours and its refresh tokens are rotating and single-use, which
   creates two ways to permanently break a connection: losing the replacement
   after spending one, and two requests spending the same one concurrently.
   Handled by ordering (persist before returning) and by a `refresh_started_at`
   claim, the same shape as `posts.publish_started_at`.

5. **A test caught a real bug in my own first cut.** The revoked/unavailable
   split was written as "any 4xx means the grant is dead", which reads **429 as
   revocation** — so a rate-limited refresh would disconnect the member. On a
   Free tier whose budget is shared across every user of the app, that is not a
   hypothetical. Narrowed to exactly 400/401. See LEARNINGS.md.

6. Gates: tsc clean, eslint clean on `lib/x`, 37 new tests passing (291 total).
   One pre-existing failure, `lib/ai/generate.test.ts`, which calls the live
   Gemini API and timed out — untouched by this branch.

**Blocked on**: `X_CLIENT_ID` / `X_CLIENT_SECRET` from the X developer console.
Nothing can be verified end-to-end until those exist. Routes and UI are next and
don't need them to be written.

### Routes and UI (same branch, continued)

7. **`app/api/connections/x/{authorize,callback}/route.ts`** — mirrors the
   LinkedIn pair, plus PKCE: the authorize leg puts the verifier in the same
   httpOnly state cookie as the CSRF state and project id, the callback presents
   it at the exchange. The callback stores the handle and the refresh token, and
   resets `status`/`refresh_started_at` explicitly so a reconnected row can't
   inherit a dead state from its previous life.

8. **UI**: X's row is connectable (`available: true`); `handleConnect` routes to
   `/api/connections/<platform>/authorize`; failure copy is now a function of
   the provider's label, with the X routes labelling their failures via
   `connect_error_platform` (LinkedIn's routes untouched — an absent label reads
   as LinkedIn). `disconnectSocialAccount` gained a two-arm switch that revokes
   X's *refresh* token, that being the one that ends the connection.

9. **The liveness probe is fenced off from X**, in the hook and again in the
   server action. X's liveness is a free by-product of its token refresh;
   probing it would spend from the Free tier's ~100 monthly reads — a pool
   shared by every user of the app — on every check of every account.

10. **`fetchSocialAccounts` now resolves the connection horizon**:
    `refresh_expires_at ?? expires_at`. An X access token expires in two hours,
    so a row rendering its own `expires_at` would tell every X user their
    connection expired today, forever. Resolving it in the query means none of
    the three consumers (connections panel, connected row, dashboard) branch on
    platform.

11. **Second real bug, caught by verifying rather than by a test.** The routes
    derived their redirect URI from `request.nextUrl.origin`, which Next pins to
    `localhost` in development whatever host was requested — and X cannot
    register `localhost` at all, so every connect attempt would have been
    rejected by X. Added `resolveRequestOrigin`, which prefers the `Host` header
    but only for loopback addresses (a client-controlled Host is otherwise an
    open-redirect vector). Verified live: the same route now redirects to
    127.0.0.1 or localhost according to which was actually requested.

12. Verified without a session (curl against :3003): bad project id, missing
    state cookie, and a denied consent all redirect back with the right code and
    the X label. **The signed-in half is not yet verified** — 127.0.0.1 is a
    different cookie origin from localhost, so the existing session doesn't carry
    over and only the user can sign in.

13. **Three reported symptoms on 127.0.0.1, one cause.** No segmented-control
    pill, clicks falling through to the wrong tab, and missing artwork were all
    Next refusing cross-origin dev assets to any hostname but the one it booted
    on. Added `allowedDevOrigins: ["127.0.0.1"]`. Verified in-browser after a
    restart: artwork, wordmark and toolbars render, the pill draws on a fresh
    load of `?view=login`, and clicking between the two tabs moves it correctly.
    See LEARNINGS.md — this presented with an empty console, which argues
    against the actual answer.

### End-to-end verification against the real X API

14. **The connect flow works.** Authorize redirect carried exactly the right
    params (redirect_uri on 127.0.0.1, `users.read tweet.read offline.access`,
    S256 challenge, state); consent granted; the callback stored the row and the
    page renders "Connected as @gdwn__" with avatar and "Expires in 180 days" —
    the refresh horizon, not the 2-hour access token, confirming the
    `refresh_expires_at ?? expires_at` resolution. DB row: access token 1.98h,
    refresh 180d, scope with no write, claim released.

15. **`next/image` throws on an unlisted host — it does not merely fail to draw
    the image.** The first successful connection rendered the app's
    "We couldn't load this page" error boundary while the row sat perfectly in
    the database, because X's avatar is on `pbs.twimg.com` and next.config.ts
    listed only LinkedIn's hosts. Added `pbs.twimg.com` and `abs.twimg.com`
    (the latter serves the default avatar for accounts that never set one).

16. **Live-tested the refresh, and broke the connection doing it.** The probe
    called `refreshAccessToken` against the real endpoint. The rotation
    succeeded — but vitest buffered the run's stdout, so the replacement token
    was never captured, and X had already invalidated the old one. That is
    precisely the failure mode lib/x/token.ts is built to prevent (persist
    before use); the probe had no such ordering because it wrote nothing.
    Row set to `status = 'revoked'` with the dead token cleared, matching what
    `getLiveXAccessToken` writes on the same discovery, and the UI correctly
    showed "Connection revoked" + Reconnect. Reconnecting restores it.

    Two things confirmed live regardless: X's refresh tokens really are
    single-use, and re-presenting a spent one returns a status our code
    classifies as `revoked` rather than `unavailable` — the exact distinction
    the 400/401-only narrowing exists for.

    **If this is probed again, write the rotated token back in the same step
    that fetches it, or drive it through `getLiveXAccessToken` (which does),
    rather than printing it.**

### getLiveXAccessToken gets its caller

17. **The liveness check is the legitimate in-branch caller.** The obvious one
    is publishing, which is out of scope (AGENTS.md's hard constraint, and it
    belongs to feat/linkedin-publish). But X's liveness *is* its refresh result,
    so `checkSocialAccountLiveness` now dispatches per platform: LinkedIn spends
    a request via `verifyLinkedInToken`, X calls `getLiveXAccessToken`, which
    renews the token it needs to renew anyway and reports `revoked` only when X
    rejects the grant. The returned access token is deliberately discarded —
    a server action's return value goes to the browser.

    The throttle (`isLivenessCheckDue`) moved above the platform split, where it
    governs both; for X it is what stops a page visit rotating a token that
    still has hours on it. `hooks/use-connection-liveness.ts` is platform-blind
    again — the earlier X filter there pushed a server-side policy into the
    client and left X connections never checked at all once they had a real
    answer to give.

18. **Not verified end-to-end, and worth being precise about why.** The server
    render fetches the right rows (logged: both accounts due after forcing
    `last_checked_at` back three hours), but the client effect that calls the
    action never fired in the automated browser tab, so no request was made and
    the row is unchanged. Instrumentation confirmed the hook body and effect run
    in a *foreground* tab and — separately — that the client there was hydrating
    from a stale RSC payload whose `last_checked_at` was recent enough for the
    throttle to say "not due", while the server had the fresh value. Both
    platforms behave identically here, so this is not X-specific.

    What *is* verified: `getLiveXAccessToken` by 14 unit tests, and
    `refreshAccessToken` against the real X endpoint (step 16). What is not: the
    hook → action → getLiveXAccessToken wiring, in a browser.

19. **Verified end-to-end in a real browser**, closing the gap in step 18.
    Opening the Connections page with both accounts forced past the throttle:
    X's stored refresh token changed (`v1.yzQ/…` → `v1.5VLviye…`, i.e. rotated
    *and* persisted), its access token went from expired to a fresh 1.99h,
    `refresh_expires_at` restamped to 179.999 days, `refresh_started_at` back to
    null, and `last_checked_at` moved — while LinkedIn was checked in the same
    pass down its own `verifyLinkedInToken` path. The whole chain (hook → server
    action → platform dispatch → getLiveXAccessToken → real X refresh → persist
    → claim release) is confirmed against the live API.

    The automated-browser tab never fired this; the user's own foreground tab
    did on the first load. Worth remembering for future verification of anything
    driven by a client effect — see the existing automation note in AGENTS.md
    about evals backgrounding the tab.

### X post length, and handle-first labels

20. **X posts are constrained to 280 characters.** `build-prompt.ts` named the
    platform but stated no ceiling, so every X post generated was
    LinkedIn-shaped and unpostable. `PLATFORM_LENGTH_LIMITS` now carries it, and
    the constraint is stated **twice** — once in the opening line, once
    immediately after "write one complete post". The repetition is deliberate:
    a limit mentioned only at the top competes with the instructions, style
    examples and reference material that follow it, and models drift long. Same
    recency reasoning `buildRegenerateSection` already relies on.

    Applied to the **single-prompt branch too**. `singlePromptText` overrides
    the tone/rules/structure/avoid fields — a voice decision — but a platform's
    ceiling is a fact about the destination, not a preference being overridden.

    LinkedIn is deliberately left unconstrained: its own limit is 3,000, high
    enough that nothing generated here approaches it, so stating it would spend
    prompt budget narrowing a target that never binds.

    **280 is the free-tier number and is applied to every user by decision, not
    by detection** (confirmed with the user, who is on Premium themselves). X
    Premium allows 25,000, but the API offers no reliable tier signal, and
    generating something a free account cannot publish is a worse failure than a
    Premium user getting a shorter post. If that changes, it should be a
    per-account setting.

21. **Post cards label an X post with its handle** (`@gdwn__`), not the display
    name — the handle is the identity on X, and it is what separates two people
    sharing a display name. LinkedIn keeps the name, having no handle. Falls
    through handle → name → platform label, so a blank name still renders
    something. Guards against a stored value that already carries an "@".

22. Gates: tsc clean, eslint clean across every file this branch touched, 301
    tests passing. The one failure is the pre-existing `lib/ai/generate.test.ts`,
    which calls the live Gemini API and is now returning an explicit free-tier
    quota error — untouched by this branch.

**Threads were considered and declined** (user: "leave as single post, LinkedIn
is the major thing this app"). Notes if it ever comes back: X has no thread
endpoint, so a thread is N sequential `POST /2/tweets` each carrying
`reply.in_reply_to_tweet_id`; every tweet counts separately against both the
500/month app-wide cap and the 17/24h per-user cap; and partial failure is the
real design problem, since there is no transaction and a half-published thread
is public with no clean undo. It would also need a schema shape `posts` does not
have — one `content` field and one `provider_post_id`.

### Over-length posts switched to X

23. **The problem:** the account pill lets a post move from LinkedIn to X, and a
    LinkedIn post is typically several times X's 280-character limit. Nothing
    said so, so the switch silently produced an unpostable post.

    Useful thing found first: `regeneratePost` builds its prompt from
    `row.platform`, so a post switched to X and then rerolled *already* comes
    back under 280 with no extra work. The fix was never about generation — the
    escape hatch existed and was invisible.

24. **Chosen (with the user, over "counter only" and "block the switch"):
    counter + a nudge at the moment of the switch, never blocking.** Blocking
    was rejected because moving a post and *then* shortening it is a legitimate
    order of operations.

    - `lib/post-length.ts` — the limit and `postLengthStatus`/
      `exceedsPlatformLimit`. **Its own module on purpose**: the number is
      needed by the prompt builder (server) and post cards (client), and a card
      importing it from `lib/ai/build-prompt.ts` would drag the prompt builder
      into the browser bundle — the trap AGENTS.md documents and
      `lib/ai/no-client-sdk.test.ts` catches. build-prompt.ts now imports from
      here.
    - `components/shared/post-length-counter.tsx` — "1,513 / 280", danger
      coloured with a warning glyph once over. **Renders nothing below 80% of
      the limit**, and nothing ever for a platform without one, so it does not
      appear on LinkedIn posts or short X ones. A permanently visible counter
      would be noise on every card in the app for the sake of the rare post that
      needs it.
    - The nudge fires in `post-details.tsx` and `day-deck.tsx`, both carrying a
      Regenerate action. Details opens the regenerate *dialog* (model and topic
      are choices the user already makes there); the deck regenerates directly,
      matching its own Regenerate button. Both replace the nudge with the error
      toast if the switch itself then fails, so a warning can't outlive the
      change it was warning about.
    - `day-deck.tsx`'s toast state gained an `action`, held in state beside the
      message for the same reason the message is — so the button doesn't vanish
      mid-exit-animation.

    **Counting is deliberately approximate.** `String.length`, not X's own
    weighting (CJK counts double; every URL collapses to 23 characters
    regardless of length). Reproducing that means shipping their counting rules
    for a number that is advisory here — nothing publishes yet, and X enforces
    the real ceiling whatever we display. It over-counts posts containing links,
    which is the safe direction: it nudges shorter rather than promising a fit
    that isn't there. Revisit when publishing lands.

25. Verified in-browser on a real 1,513-character LinkedIn post: switching to X
    raised "TOO LONG FOR X (1,513 / 280)" with a Regenerate button, the pill
    became `𝕏 @gdwn__`, and the counter rendered "⚠ 1,513 / 280" in danger
    beside it. The post was switched back to LinkedIn afterwards — it is real
    user data, not a fixture. tsc and eslint clean, 309 tests passing.

### Reworked, per direct feedback: refuse the switch instead of warning about it

26. **Bug fixed: Try out was inheriting X's limit.** `postAccountCycle` gives a
    Try out position the *post's own* platform (so switching to it and back is
    lossless), so an X post switching to Try out arrived at the guard with
    `target.platform === "x"` and tripped it. Nothing is ever published from a
    try-out post, so the check is now skipped whenever `target.isTryout` — an
    exemption that is load-bearing rather than cosmetic, and commented as such
    at both call sites.

27. **The counter is gone** (`components/shared/post-length-counter.tsx`
    deleted, both usages removed), along with the toast nudges. Superseded by:

28. **The switch to an over-limit platform is now refused, not warned about.**
    A `ConfirmationModal` (reused, no new UI component) says "Too long for X —
    This post is 1,513 characters and X allows 280. Regenerate it to fit, or
    shorten it yourself first," with a Regenerate action. The post does not move.

    **The ordering problem this created, and how it is solved.** Regeneration
    builds its prompt from the row's platform, so a post refused entry to X is
    still on LinkedIn and would reroll long again — the fix would never
    converge. Both regeneration paths (`/api/regenerate-post` for post-details,
    `regeneratePost` for the deck) therefore take an optional `targetPlatform`,
    used **only** to build the prompt; neither writes `platform`. The client
    applies the switch itself, last, and only on a clean finish — so a post
    whose reroll failed is never left sitting on a platform it does not fit.

    post-details hands the pending switch through its regenerate *dialog* (model
    and topic are choices made there), held in a ref because the modal closes in
    the same tick the dialog opens. The ref is consumed at the top of
    `handleRegenerate` and cleared if the dialog is dismissed, so no failure path
    can leave a stale switch to be applied by a later, unrelated reroll. The deck
    has no model picker, so its modal starts the reroll directly.

29. Verified in-browser: a 1,513-character LinkedIn post refuses the switch and
    shows the modal while the pill stays on "Godwin John"; the 1,459-character
    X post from the report switches to Try out with no modal at all. Both posts
    were restored to their original platform/tryout state afterwards — real user
    data, not fixtures. tsc, eslint and 309 tests clean.

**Known consequence, not yet resolved:** the account pill cycles
[Try out, LinkedIn, X], so from LinkedIn the only way to reach Try out is
*through* X. With an over-length post, X is refused — which means Try out
becomes unreachable from LinkedIn until the post fits. Raised with the user
rather than silently worked around; the fix is either skipping a refused
position in the cycle or replacing the cycling pill with a menu.

30. **The cycle skips a refused position** (per direct choice, over a menu).
    `nextPostAccount` takes an optional `isRefused` predicate and walks the
    whole cycle rather than looking only at the next entry, so more than one
    refused position in a row is stepped over too. When *every* other position
    is refused it returns the first refused one rather than null — a pill that
    silently does nothing reads as broken, and that is the one case where the
    user has to be told the post is too long. Both call sites share one
    `refusesPost` predicate with the guard in their switch handler, so the pill
    and the guard cannot disagree.

    Modal icon brought in line with the app's other confirmation modals:
    `weight="bold"`, `size-12`, `text-icon-minimal` (was an unsized `fill`).

    Verified in-browser: the 1,513-character LinkedIn post now cycles straight
    to Try out, stepping over X, with no modal — confirmed in the database
    (`platform: linkedin, is_tryout: true`) rather than from the screen, since
    clicks that land before hydration silently do nothing and made this look
    broken twice. Post restored afterwards.

**Consequence of the skip, raised with the user:** with LinkedIn and X both
connected, Try out is always an allowed position, so an over-length post now
skips X *every* time and the modal is effectively unreachable — taking its
"Regenerate to fit X" button with it. The remaining route to X is shortening the
post by hand. If that matters, the fix is a separate affordance for "rewrite
this for X" rather than relying on the refused-switch modal to offer it.

31. **The silent skip is reverted; the dialog does the skipping instead**
    (per direct request, superseding item 30's cycle behaviour). The pill offers
    X like any other position again — a position that quietly stops being
    offered reads as "X isn't connected", and the user never learns the post is
    simply too long. So the refusal happens in the handler, and the dialog is
    where both the reason and the ways out live:

    - **Regenerate** — rerolls for X via the `targetPlatform` plumbing, then
      applies the switch once text that fits exists.
    - **Skip to Try out** — the position the cycle would have reached had the
      refused one not been offered, so the pill is never a dead control.
    - **Closing it changes nothing**, which is why the skip has to be an
      explicit button rather than something dismissal does.

    `nextPostAccount`'s `isRefused` predicate survives from item 30 and is what
    computes that skip target; it is simply no longer applied to the pill
    itself. The button's label is derived from the target's own resolved
    account label rather than hardcoded, so it stays correct if the skip lands
    somewhere other than Try out.

    `ConfirmationModal` gained an optional `secondaryAction` — an addition to
    the Figma export, which draws one button. `brand-secondary` keeps it
    subordinate to the primary action.

32. Verified in-browser: the pill now stops at X and shows the dialog (bold
    48px warning icon, "Too long for X — This post is 1,513 characters and X
    allows 280", Regenerate over Skip to Try out); "Skip to Try out" moved the
    post to `is_tryout: true` while leaving `platform` on linkedin. Post
    restored afterwards. tsc, eslint and 313 tests clean.

33. Three follow-ups, per direct feedback:
    - **Modal actions sit `dist-md` apart**, in their own `flex-col` stack
      rather than inheriting DialogContent's `dist-lg` rhythm — two buttons
      offering alternatives read as one control group, not two more sections.
    - **The icon is gone from the too-long dialog** (a look the user wanted to
      see). `ConfirmationModal`'s `icon` is now optional; the delete and
      disconnect dialogs keep theirs.
    - **The pill shows the account a reroll is writing *for*** while it is in
      flight, instead of the one the post is still on. Display only — the post
      genuinely stays put until the new text lands, which is the whole point of
      refusing the switch — but showing the old account while the user watches
      a post being written for the new one is a lie about what is happening.
      Gated on `isRegenerating` rather than cleared on every exit path, because
      `releaseRegenerate` deliberately does no setState (it runs on unmount
      too), so a stale `regeneratingFor` simply never renders. The pill is also
      inert mid-reroll, so it can't be cycled into a third state.

34. **Found while verifying, and fixed: the switch was committing on the
    strength of the reroll alone.** Regenerating with TasteTest — which ignores
    the prompt and returns fixed text — moved a post to X at 1,513 characters,
    the exact state the refusal exists to prevent. "It has been regenerated" is
    not "it fits": a real model can overshoot too. Both paths now re-check the
    new content against the limit and only commit the switch if it passes,
    reporting "Still too long for X" otherwise and leaving the post where it
    was.

    Verified on a throwaway post created and deleted for the purpose, so no
    real post's content was destroyed — regeneration is not reversible, unlike
    the platform switches used in earlier rounds.

35. **The Generating page had no guard at all** — reported by the user. Its
    `handleSocialChange` (components/generate/generating-view.tsx) predates the
    Content-side work and switched to X with no check, which is the screen where
    a fresh batch is *most* likely to be reassigned. Now carries the same three
    pieces as post-details and day-deck: the `refusesPost` predicate shared
    between pill and guard, the refusal dialog with Regenerate / Skip, and the
    post-reroll re-check that only commits the switch if the new text actually
    fits. `handleRegeneratePost` gained the same optional `switchTo`.

    Lint note: `generating-view.tsx` reports one `react-hooks/set-state-in-effect`
    error, confirmed pre-existing by stashing this branch's changes and
    re-running (same error, line 677 rather than 725 — it only moved because
    lines were added above it).

36. Self-inflicted: the stash round-trip in step 35 briefly reverted
    next.config.ts, and the running dev server kept the reverted
    `allowedDevOrigins` in memory — reproducing the dead-page symptom from step
    13 with the file on disk still correct. Restarting the server fixed it;
    verified the pill renders and moves (Queued → Draft, with the drafts info
    line appearing). See LEARNINGS.md — compare a lint baseline via
    `git show main:<file>` rather than stashing while a server is up.

37. **TasteTest is greyed out in the regenerate dialog when the reroll targets a
    length-limited platform** (per direct request). `SelectPillOption` already
    had a `disabled` flag rendering the export's dimmed unselectable row, so
    this is a filter, not new UI. `RegenerateModal` takes a `targetPlatform` —
    the platform a refused switch is waiting on, or the post's own.

    **The selection also falls back, which is the half that matters.** The model
    preference is persisted per project, so anyone whose last Generate run used
    TasteTest arrives with it already selected; without a fallback the pill
    would sit on a greyed-out model and confirm a reroll that cannot succeed.
    `selectedModel` now rejects a disabled option as well as a missing one, and
    `onConfirm` passes `selectedModel.value` rather than the raw state.

    post-details' pending switch moved from a ref to state for this — the
    dialog renders from it, since it is what says which platform the reroll is
    for. Verified in-browser on the 1,459-character X post: the dialog opened on
    "Gemini 3.6 Flash" instead of the persisted TasteTest, and TasteTest renders
    dimmed while the user's own BYOK models stay selectable.

### Review fixes (held at /integrate, not merged)

38. **BLOCKER: "Skip to …" performed the switch its dialog had just refused.**
    `nextPostAccount` deliberately returns the *refused* target when every
    position is refused, so the pill stays live and can explain itself. All
    three call sites documented the opposite ("null when there is no such
    position") and rendered the skip button off it — so in the one case the
    button was supposed to be absent, it was present and committed the refused
    switch. Reproduced with the reviewer's case (only X connected, over-length
    Try-out post): the old call returned a target for which `refusesPost` is
    true.

    Fixed by splitting the contract rather than weakening either side, since
    the step-over behaviour is right for the pill: `nextAllowedPostAccount`
    (lib/post-account.ts) wraps `nextPostAccount` and returns null when the
    result is refused. The three call sites now use it; the pill still uses
    `nextPostAccount`. Both are pinned by tests, including one that asserts the
    two disagree in exactly the all-refused case.

39. **A claim leaked on the undecryptable-token path** (lib/x/token.ts). The
    `if (!refreshToken)` early return sat inside the claimed region without
    calling `releaseClaim`, three lines under a comment promising every path
    released it — reachable via a rotated `MODEL_KEY_ENCRYPTION_KEY`, and it
    wedged the account permanently: every later request found a claim nothing
    would release and timed out in `waitForOtherRefresh`, forever.

    Fixed with `try/finally` rather than a fourth `releaseClaim` call, per the
    review — a `finally` cannot be forgotten by the next early return. A
    `claimWritten` flag skips the release on the two paths that null the column
    as part of a write they were already making. Three tests cover it: the
    undecryptable token, an unreachable X, and a throw mid-refresh.

40. **A reroll launched from the too-long dialog had no pending state.**
    `GeneratedPostCard` owns its placeholder and its own re-entrancy guard, so a
    parent calling `handleRegenerate` directly showed no feedback at all and
    could run alongside a second reroll from the card's own button. The card
    gained an optional `regenerating` prop that ORs into both; day-deck and
    generating-view track the id they started and clear it in `.finally()`.
    post-details already had `isRegenerating` driving the whole page.

41. Gates: tsc clean, lint at main's 17-error baseline (16 in files this branch
    never touched, one pre-existing in generating-view.tsx), build clean, **318
    tests passing with `lib/ai/generate.test.ts` excluded** — it calls the live
    Gemini API and is currently rate-limited, per FOLLOWUPS §12.

    Scope was deliberately not widened, per the review.

### Merged `main` after `feat/x-connect` landed, 2026-09-03

Second in the merge order, as instructed. Three conflicts, exactly as predicted:

- **`.env.local.example`** — two tail appends. X's credentials now sit beside
  LinkedIn's; `CRON_SECRET` and the note on `PRESTO_ENABLE_LIVE_PUBLISH` follow
  both.
- **`lib/supabase/queries.ts`** — both sides added columns to
  `fetchSocialAccounts`. Kept both: the select carries `account_handle`,
  `refresh_expires_at` *and* `scope`, and the mapping keeps x-connect's
  `refresh_expires_at ?? expires_at` resolution (X's access token lapses in two
  hours; the refresh horizon is the real one) alongside `scope`.
- **`components/content/day-deck.tsx`** — the only real work, and smaller than
  it looked: git auto-merged both sides' state, handlers and dialogs, leaving a
  single conflicted import. What needed a human eye was everything it merged
  *without* conflict, which was checked rather than trusted — `handlePublish`
  sits before x-connect's `refusesPost`/`handleSocialChange`, the card carries
  both sides' props (`statusMarker`/`onPublish` and
  `regenerating`/`onSocialChange`), and the publish confirmation and the
  blocked-switch dialog coexist.

Two comment artifacts fixed, both from the auto-merge rather than either
branch: the "Platform and isTryout move together" note had been orphaned onto
x-connect's `refusesPost` helper and was folded back into
`commitSocialChange`'s own comment, and an import list came through as
`nextAllowedPostAccount,  nextPostAccount,` on one line.

`lib/post-publish.test.ts`'s account factory needed `accountHandle: null` —
x-connect widened `ConnectedSocialAccount`, and tsc caught it.

**The seam between the two branches, checked deliberately.** X posts now exist,
and publishing must not touch them: `publishBlockedReason` returns
`platform_unsupported` for an X post **even when an X account is connected**
(that check runs before `not_connected`), and the cron's own selection query
filters `platform = linkedin`. Both were already pinned —
lib/post-publish.test.ts covers the first, the query the second — so no new test
was needed. Length limits can't reach publishing either: `PLATFORM_LENGTH_LIMITS`
defines only X, and X can't be published.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run lint` | 17 errors — `main`'s own baseline, all in files this branch never touched (switch.tsx, generate-calendar-column.tsx, create-project-modal.tsx, onboarding-context.tsx, project-sidebar.tsx, generating-view.tsx) |
| `npx vitest run --exclude lib/ai/generate.test.ts` | 346 passed / 29 files (excluded per FOLLOWUPS §12 — live Gemini quota, ~90s) |
| `npm run build` | clean, `/api/cron/publish` present as a dynamic route |

**Still undefined: "the interleaving test."** It matches nothing in the repo
before or after x-connect landed, and x-connect added no test by that name
(build-prompt, post-length, x/oauth, x/token, post-account). The mixed-platform
seam it most plausibly refers to is covered above. Flagged rather than invented.

---

## 2026-09-03 — `feat/linkedin-publish`: close the review blocker

Picked up after `main` was merged in (`8150b8c`) but the blocker itself was
still open — verified directly rather than assumed: both halves were byte-for-
byte as the reviewer left them, with no uncommitted work and no stash.

**The blocker — the scheduler could double-post to a real timeline.** Two facts
combined: `CLAIM_TIMEOUT_MS` (5 min) was shorter than `PUBLISH_GRACE_MINUTES`
(15), so a claim went stale ten minutes before its post left the due window; and
the success write was awaited with no error check, so a failed write left
`published_at: null` — indistinguishable from a post that never went out. A
later tick would re-claim and re-send it.

Fixed both halves, because either alone still leaves a live double-post path:

- `CLAIM_TIMEOUT_MS` is now **derived**: `(PUBLISH_GRACE_MINUTES + 1) * 60_000`.
  The `+ 1` makes the ordering strict rather than merely equal, so the last tick
  that can see a post is never the tick that can re-claim it. Two independent
  constants could drift back into overlap; a derived one cannot.
- The success write's error is checked, and produces a new **`record_failed`**
  outcome. The post is live and the row does not say so, which is a distinct
  state, not a publish failure. It is never retryable, the claim is deliberately
  **left held** (an unreleased claim delays one post; a released one publishes it
  twice), the URN is carried out on the outcome, surfaced in the cron summary and
  `console.error`'d — it is the only surviving record that the post is live.
  Its user-facing message says the post *published* rather than that it failed:
  telling someone their post failed while it sits on their timeline is the one
  wrong answer.

**New `lib/publish-runner.test.ts`** (6 tests) with a Supabase stand-in shaped to
the four chains the runner builds. **Both halves were verified against the bug,
not just the fix**: reintroducing the unchecked write fails 2 tests,
reintroducing the 5-minute claim fails 1.

**Also fixed, from the same review:**

- **One bad token no longer halts publishing for everyone.** `decryptApiKey`
  throws *after* the claim is taken, and the cron loop had no `try`. Now wrapped
  per post, so one corrupt token strands its own post rather than 500ing the
  route and stopping every other project on every tick.
- **`CRON_SECRET` is compared with `timingSafeEqual`.** It was `!==`, which
  short-circuits at the first differing byte — exactly the measurement the
  comment claimed the length pre-check prevented. The misleading comment is gone.
- **The publish modal can no longer become permanently unclosable.** Its dismiss
  guard is `if (!open && !publishing)`, so a throw that left `publishing` true
  locked it with no way out but a reload. Now `try/finally`.
- **`no-client-sdk.test.ts` now guards the new server-only modules** —
  `lib/linkedin/publish`, `lib/linkedin/oauth`, `lib/supabase/service` and
  `lib/publish-runner`. `lib/linkedin/scopes` is deliberately dependency-free so
  the Connections page can import *it* instead; nothing enforced that until now.

**Deliberately not done — both need a decision, not a fix.** Logged as
FOLLOWUPS §17 and §18: refusals that record nothing re-select every tick and
occupy the whole `limit(5)` (fixing it means choosing whether a scope refusal
marks a post failed), and a published post is still editable, regenerable and
re-datable (what those controls *should* do on a live post is a product call).
Neither is reachable while the gate is shut.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run lint` | 17 errors — compared against `main`'s own run, identical |
| `npm run test` | 352 passed / 30 files, excluding `lib/ai/generate.test.ts` (FOLLOWUPS §12) |
| `npm run build` | clean |

**Unchanged and re-confirmed:** `PRESTO_ENABLE_LIVE_PUBLISH` still absent from
`.env.local` and `.env.local.example`, `checkPublishGate` still refuses on it
first, no migration, no `vercel.json`, no cron registration.

---

## 2026-09-03 (later) — second review round: three holes in the fix above

The `/integrate` review held the branch again. Two of the three findings were in
the fix commit itself (`d222c83`), and both were right.

**1. `record_failed` did not actually block anything.** The comment claimed the
claim was "deliberately left held", but a claim is a *lease*: the claim
predicate re-grants any claim older than `CLAIM_TIMEOUT_MS`, so holding it only
delayed a second publish by sixteen minutes. The cron never noticed — the post
has left its due window by then — but **the manual "Publish now" path does not
look at the date at all** (verified: no `scheduled_for`, `isDueNow` or
`dueWindow` anywhere in publish-actions.ts), so a person clicking it later would
have re-sent a post already on their timeline. The first fix reproduced the
exact bug it was written to close, one path over.

Now durable rather than time-based: a `record_failed:<urn>` marker is written to
`publish_error` (a smaller write than the one that just failed — no
`published_at`, so it cannot trip the published-needs-a-provider-id constraint)
and the claim predicate gains `.not("publish_error", "like", "record_failed:%")`,
which never expires. The URN lives inside the marker, so the only durable record
that the post is live is also the thing preventing it being sent twice. The claim
is still held as well, covering the window before the marker write is attempted.

**2. The failure branch's release write was still unchecked** — the identical
omission the fix had just repaired on the success write two blocks below, in the
same function. It cannot duplicate anything (nothing was published on that path)
but it would leave the post wearing "Overdue" with no "Didn't send" marker and no
reason. Checked now, and `recorded` reports what actually happened.

**3. `try/finally` was added to one of two publish handlers.** `day-deck.tsx` got
it; `post-details.tsx:802` has the same `if (!open && !isPublishing)` dismiss
guard and the same permanently-unclosable-modal failure. Fixed.

**And one that was nobody's fix but the merge's:**
`connected-account-row.tsx` called `grantIsCurrent(account.scope)` for **every**
account, but that asks a LinkedIn question — `LINKEDIN_SCOPES.every(...)`, now
including `w_member_social`. An X row stores `users.read tweet.read
offline.access` and can never satisfy it, and reconnecting X grants X's scopes
again. So every connected X account would have worn a permanent "Reconnect to
grant Presto permission to post" chip, for a permission X is not asked for and
that no user action could clear. X shipped on `main` while this branch was open,
so the two only met at the merge — the one finding here that misfires with the
publish gate shut and no cron armed. New `isGrantStale(platform, scope)` in
scopes.ts is now what call sites use.

**Tests: 358 passing (was 352).** Three new in publish-runner.test.ts (the
permanent marker, refusal long after the lease would have lapsed, the release
write's own failure) and three in scopes.test.ts for `isGrantStale`. Each was
verified against its regression, not just the fix: restoring the lease-only
version fails 2, unchecking the release write fails 1. The fake's chain needed
`.not` added — it broke loudly rather than passing against the new predicate,
which is the behaviour a fake has to have.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run lint` | 17 errors — `main`'s baseline |
| `npm run test` | 358 passed / 30 files, excluding `lib/ai/generate.test.ts` |
| `npm run build` | clean |

**Lower-severity, left alone deliberately:** `lib/linkedin/oauth.ts:176`'s
`scope: body.scope ?? LINKEDIN_SCOPES.join(" ")` fallback now asserts a
`w_member_social` grant that may not have been made — textually unchanged, but
its meaning moved with this diff. Real, low-likelihood (LinkedIn does return
`scope`), and it belongs with the §17 decision about how a stale grant should be
treated rather than being patched blind. Also unchanged: `lib/clock.ts:25`'s
stale `now`, and the success toast that unmounts with the deck when publishing a
day's last post.

---

## 2026-09-03 (third round) — the fix that silently killed publishing

The review held the branch a third time, on a finding in my own previous commit,
and it was the most serious one yet.

**The `.not(… like …)` claim predicate excluded every post.** `NOT (col LIKE …)`
is NULL, not true, for a NULL column, and `publish_error` is NULL on every post
that has never failed. So the guard written to stop *one* post being re-claimed
stopped *all* of them: publishing was entirely, silently dead through both the
button and the cron, reporting "already being published" for every post. Verified
two ways against the live database — raw SQL (0 of 311 rows pass the bare form,
311 pass the null-safe one) and a probe through real supabase-js/PostgREST
(baseline 311, bare `.not` **0**, null-safe `.or` **311**, and a marked row still
correctly blocked at 0, so the block keeps its teeth).

Now `.or("publish_error.is.null,publish_error.not.like.record_failed:*")`.
Chained `.or()` calls AND together, so it composes with the stale-claim one.

**Why 358 green tests said nothing.** The fake in publish-runner.test.ts
re-implements predicates in JavaScript, where the NULL case reads as "not
blocked" — the opposite of the database. A fake proves the code calls the query
you meant; it cannot prove the query means what you think. Added **`the claim
predicate is null-safe`**, which records the filter calls and asserts no negative
filter on `publish_error` exists without an explicit `is.null` arm — verified to
fail when the bare `.not` form is restored. That is the part a fake can speak to
honestly.

**And I nearly repeated the ai-models bundle bug in the same commit.** Putting
`RECORD_FAILED_PREFIX` in publish-runner.ts and importing it from
publish-failure.ts — which client components read — would have pulled the runner,
Supabase and the share call into the browser. The constant now lives in
publish-failure.ts (pure, already client-safe) and the runner imports and
re-exports it. Verified against a real build: client chunks contain no
`service_role` and no `api.linkedin.com`; the single `w_member_social` hit is
lib/linkedin/scopes.ts, which is deliberately client-safe and present on `main`
too. Chunks 3.4M, unchanged.

**Also fixed, from the same review:** a `record_failed` post showed "Didn't send"
over *"This post didn't go out. Try publishing it again."* — for a post live on
the timeline, inviting exactly the re-publish the marker prevents. Now
`publishFailedLabel()` returns "Sent, not recorded" and the message says the post
published. `publishErrorFor()` makes the client's optimistic patch match the
marker the server actually writes, URN included, so the card does not change its
story on reload.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run lint` | 17 — `main`'s baseline |
| `npm run test` | 359 passed / 30 files, excluding `lib/ai/generate.test.ts` |
| `npm run build` | clean, client bundle verified free of server modules |

---

## 2026-09-04 — fourth round: the copy fix that never reached the client

Held again, on a defect in the previous commit, and the reviewer was right.

**`publishErrorFor()` was correct and unreachable.** The server action's error
branch was typed `{ error; failure?; recorded? }` with no `publishedUrn`, and
its return discarded `outcome.publishedUrn`. **TypeScript could not catch it**:
`publishedUrn` is optional on `publishErrorFor`'s structural parameter, so
dropping it type-checks perfectly. The client therefore mirrored a bare
`"record_failed"` while the row held `"record_failed:<urn>"`, and every reader
misclassified it — the card said "Didn't send" over *"This post didn't go out.
Try publishing it again"* beneath a toast saying the post had published, then
changed its story on reload. Both call sites were affected; both correctly
guarded on `result.recorded`, and neither received the URN.

Fixed by threading `publishedUrn` through `PublishPostResult`, with a comment on
the field saying why it must cross that boundary.

**A third contradictory message, from the same root.** `publishBlockedReason`
keys on `publishedAt`, which is null on this path, so "Publish now" stayed
enabled on a post already live; clicking it hit the claim predicate and returned
*"That post is already being published"*. It now also returns
`already_published` for a `record_failed` marker — the marker is the only thing
that can see this state.

**New `lib/publish-failure.test.ts` (7 tests)** pinning the thing the type system
cannot: that what the client mirrors equals what the server wrote. One test
deliberately asserts the *broken* shape misclassifies, documenting why the field
has to be passed rather than leaving a future reader to rediscover it.

**Two stale comments corrected in `lib/linkedin/publish.ts`.** They still said
the share call was "unverified against a live call — by construction, since
nothing has ever been allowed to make one", and that publish-actions.ts was the
only caller. Both false since 2026-09-03: two posts are live, and the caller is
publish-runner.ts, reached from the action *and* the cron. A stale "nothing has
ever published" in the file that owns the gate is the wrong direction to be
wrong in. Now records that a plain text share is verified and that media,
articles and non-default visibility are not.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run lint` | 17 — `main`'s baseline |
| `npm run test` | **366** passed / 31 files, excluding `lib/ai/generate.test.ts` |
| `npm run build` | clean; client chunks 3.4M, zero hits for `service_role`, `api.linkedin.com`, `SUPABASE_SERVICE_ROLE_KEY`, `LINKEDIN_CLIENT_SECRET`, `CRON_SECRET` |

**Correction to an earlier entry:** the `w_member_social` string in a client
chunk is *not* "present on main too" — `lib/linkedin/scopes.ts` is new on this
branch. It is still correct and harmless: a public OAuth scope identifier, ~40
bytes, pulled in because the Connections row imports `isGrantStale` from that
module. The claim that it predated the branch was wrong.

**One item added to FOLLOWUPS (§19):** `no-client-sdk.test.ts` only inspects
*direct* imports in `"use client"` files, so a two-hop path into a server module
is invisible — which is exactly how the `publish-failure` → `publish-runner`
import nearly shipped Supabase and the share call into the browser. This branch
widened the blast radius by adding three modules to `SERVER_ONLY`.

---

## 2026-09-04 — Housekeeping on `main`: the four post-merge defects

Nothing in flight (`worktree.sh list` empty), so straight onto `main` per
AGENTS.md. All four were found by the review passes on `feat/linkedin-publish`
and deliberately not fixed there: three predate the branch, and blocking on them
would have left `main` strictly more exposed.

**1. A 2xx with no `x-restli-id` was a double-publish path.** `postShare` treated
a missing URN header as `failure: "publish"` — "nothing was published" — so the
runner released the claim and left the post retryable. But a 2xx means LinkedIn
*did* create the post; only its name is missing. The next attempt would have put
a second copy on a real timeline.

New `published_without_urn` result, handled in `publishOnePost` *before* the
ordinary failure branch: it writes a bare `RECORD_FAILED_PREFIX` marker and
leaves the claim held, exactly as a failed `published_at` write does, minus the
URN there is no way to obtain. Verified against Postgres that `%` matches a
zero-length suffix, so the bare marker is caught by the claim predicate and by
`isRecordFailure` just as a URN-bearing one is.

**The first test written for this was worthless and was replaced.** It mocked
`publishTextPost` and asserted the runner's handling — so reverting the fix left
it green, because the bug lives in `postShare`'s response parsing, which that
test never reaches. Rewritten in `lib/linkedin/publish.test.ts` to stub `fetch`
and drive the real path: a 201 with a URN, a 201 without one, and a 422.
Confirmed the middle one fails when the fix is reverted. This is the second time
in two days the same mistake was nearly shipped, and the LEARNINGS rule about it
already existed — writing the rule down is not the same as following it.

**2. Neither client publish handler had a `catch`.** `try/finally` was added
earlier so a throw could not leave the modal permanently unclosable, but
`withNetworkStatus` rethrows anything that is not a network failure and
`decryptApiKey` throws outright on a corrupt or re-keyed token. The rejection
escaped the caller: modal closed, nothing said, no marker — indistinguishable
from a click that never registered, which invites a second click on the one
action that must not be repeated. Both handlers now catch and surface a toast.

**3. The cron stranded a post when its `catch` fired.** The throw happens after
the claim, so the row kept `publish_started_at` set with `publish_error` null.
The post then aged out of the 15-minute window before its 16-minute claim
lapsed: never retried, never marked, the response body its only trace. It now
releases the claim and records the reason. Safe precisely because nothing was
published on that path — both paths where a share *did* go out are handled
inside `publishOnePost` and return rather than throw.

**4. `lib/clock.ts` served a stale `now` on remount.** The interval is torn down
with the last subscriber, so `now` stayed frozen at the final tick — after a
spell on another page or a throttled background tab, the first render back could
read a timestamp hours old and hold it for a further minute, with nothing
overdue marked in between. `subscribeToClock` now refreshes on subscribe.

**Also logged, not code:** LEARNINGS gained the LinkedIn/X dev-origin split —
they cannot both be connected from the same origin, because X's console refuses
to register `localhost` while LinkedIn's callback is registered on it, and the
two spellings are different cookie origins. Raised by the user after noticing
the X branch ran on 127.0.0.1. Dev-only; production is one hostname.

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run lint` | 17 — `main`'s baseline |
| `npm run test` | **371** passed / 31 files, excluding `lib/ai/generate.test.ts` |
| `npm run build` | clean |

Publishing remains gated shut throughout: `PRESTO_ENABLE_LIVE_PUBLISH` unset, no
cron registered, `pg_cron`/`pg_net` absent from the live project.
