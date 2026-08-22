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
