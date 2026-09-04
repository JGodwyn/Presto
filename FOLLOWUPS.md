# Follow-ups — work parked for after the merge

Deliberately-deferred work: things a branch found but correctly did not do,
because they belong to another branch's files, need a decision, or cut across
the whole project.

**This is not a wish list.** Every entry names what to do, why it waited, and
where to start. Delete an entry the moment it is done — the file is only useful
if what's left in it is still true.

Read this after `/integrate` has landed everything, when nothing is in flight
and cross-cutting work is finally safe.

---

## 2. ~~A token revoked at LinkedIn's end is invisible to us~~ — DONE

**Done 2026-08-31** (`feat/connection-expiry`). `social_accounts.status` flips
to 'revoked' when `verifyLinkedInToken` gets a 401 from `/v2/userinfo`, checked
in the background from the Connections page on a 1h throttle; the row, the
active-connections badge and the dashboard checklist all read it through
`connectionStatus`. Verified in-browser on 2026-09-01: the revoked treatment
renders (red strip, "Connection revoked", Reconnect, no countdown, excluded from
the active count) and a live check against `/v2/userinfo` stamps
`last_checked_at` without re-calling on the next load.

---

## 3. Decide: lock down the encrypted-token column

**From:** `feat/connections-page`, 2026-08-21. **This is a decision, not a bug.**

`social_accounts.encrypted_access_token` is readable by the row's owner under
RLS. Every query in the app omits it (`fetchSocialAccounts` deliberately doesn't
select it), but a user could read their own ciphertext from the browser client.

That ciphertext is AES-256-GCM and useless without `MODEL_KEY_ENCRYPTION_KEY`,
which is server-only — so the exposure only matters in a world where that key
has *also* leaked, and in that world there are bigger problems.

**The fix is not obviously worth it.** Column-level `revoke select` would also
block the one legitimate reader (`disconnectSocialAccount`, which decrypts to
revoke the token at LinkedIn) because it runs as `authenticated` too. Restoring
it means either a service-role client in that action — service role bypasses RLS
entirely, so a bug there is strictly worse than the thing being fixed — or a
`security definer` function scoped to the caller's own row.

**Recommendation:** leave it, unless a security review says otherwise. Recorded
here so the next person doesn't have to re-derive the trade-off.

---

## 4. Cross-cutting: database advisor cleanup

**From:** `feat/connections-page`, 2026-08-21. **Do this when nothing is in
flight** — it touches every table, so it will conflict with any live branch.

`mcp__supabase__get_advisors` (performance) reports two issues on *every*
user-facing table — `posts`, `instructions`, `writing_styles`,
`content_references`, `user_ai_models`, `generation_batch_context` and
`social_accounts` alike:

1. **Unindexed foreign key** on `user_id` (INFO). One `create index` per table.
2. **`auth_rls_initplan`** (WARN) — policies call `auth.uid()` per row instead
   of `(select auth.uid())`, which stops Postgres hoisting it out of the scan.
   Rewrite each policy's `using` / `with check`.

Neither is a regression from any one branch: `social_accounts` was written to
match the existing house pattern exactly, and inherited the house's flaws with
it. Fix them together or not at all, so the tables don't drift apart.

**Also on the security advisor, unrelated to any code:** leaked-password
protection is disabled on Supabase Auth. That's a dashboard toggle
(Auth → Passwords → "Check against HaveIBeenPwned"), not a migration.

---

## 5. Publishing is built and verified — what is left is deployment

**From:** `feat/linkedin-publish`, 2026-09-03. This entry replaces the old
"prerequisites" list, which is done: `w_member_social` is requested, the manual
trigger and the scheduler exist, and **all three paths have been exercised
against the live API** — a refusal with the gate shut, a manual send
(`urn:li:share:7501150776556412931`), and a scheduled send the cron made on its
own (`urn:li:share:7501154742442684416`). See EXECUTIONS.md, 2026-09-02/03.

`PRESTO_ENABLE_LIVE_PUBLISH` is **unset**, so everything is refused again. It is
absent from `.env.local.example` on purpose: it is not configuration, it is a
deliberate act. Note the restart tax — a running server keeps the old env until
it restarts, so removing the line is not the same as the gate being shut.

### 5.1 Blocked on deployment (nothing here can be done from a laptop)

- **The pg_cron schedule.** Postgres cannot reach `localhost`, so the scheduler
  only becomes real once there is a deployed origin. Locally it was ticked with
  curl. The SQL, cadence already decided (one minute):

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

  To stop it: `select cron.unschedule('presto-publish-due');`
- **Production env**: `CRON_SECRET` (generate a fresh one, don't reuse the local
  value), `SUPABASE_SERVICE_ROLE_KEY`, `MODEL_KEY_ENCRYPTION_KEY` (must match
  whatever encrypted the stored tokens), `LINKEDIN_CLIENT_ID`/`SECRET`.
- **Register the production callback URL** with the LinkedIn app —
  `https://<origin>/api/connections/linkedin/callback`. Only
  `http://localhost:3000/...` is registered today, which is why the OAuth leg
  only works there.
- **The gate itself.** Publishing stays off in production until it is set to
  exactly `"true"`.

### 5.2 Blocked on the schema lock (`feat/x-connect` holds it)

- **A partial index on `scheduled_for`.** The scheduler queries once a minute;
  `posts` has only `posts_pkey` and `posts_project_id_idx` today. Cheap now,
  worth having before the table grows:

  ```sql
  create index posts_scheduled_for_idx on public.posts (scheduled_for)
    where published_at is null;
  ```

  Fold it in with FOLLOWUPS #4, which already collects index work.

### 5.3 Before anyone but the owner can connect

- **The LinkedIn app is almost certainly still in development mode**, in which
  LinkedIn only lets members who are admins or developers *of the app* complete
  authorization. Users never create their own app — there is one app and they
  authorize it — but until it is verified against a LinkedIn Company Page (and
  both products are added), a stranger is refused at LinkedIn's own screen. The
  cheapest test is to have one other person try Connect on a deployed build.
- **Nothing tells a user their connection died.** Tokens last 60 days with no
  refresh available to a standard app. The owner will notice the chip on
  Connections; a stranger will not, and their scheduled posts will simply stop,
  wearing "Didn't send". Needs an email or some out-of-app signal before this
  has real users.
- **LinkedIn's rate limits are per-app, shared across all users.** The
  scheduler's cap of 5 posts per tick is a useful ceiling; a busy app may need
  more thought.

### 5.4 Left deliberately

- **A failed post is never retried automatically.** It keeps its "Didn't send"
  marker until a person opens it and publishes again — retrying blind is how one
  dead connection becomes a stream of failures. If an automatic retry is ever
  wanted, it needs a bounded count and a reason to believe the cause has passed.
- **X (Twitter)** still has a `platform` value reserved and no flow behind it;
  `publishBlockedReason` returns `platform_unsupported` for it by design.
- **AGENTS.md's "Hard constraint — publishing" section still describes the old
  world** and needs the user's own hand. INTERFACE.md §10a has been rewritten to
  describe the gate that replaced it.

---

## 5b. Decide: what a *published* post may still do

**From:** `feat/linkedin-publish`, 2026-09-02. **This is an open question the
user raised and deliberately parked**, not a bug.

Publishing currently closes two doors on a post: once `published_at` is set,
post-details disables Regenerate and Move-to-drafts, on the grounds that
LinkedIn owns the copy people are reading and this screen would otherwise show
text that isn't what went out. Delete stays, and says the live post survives.

The user's own words: *"later we might need to push it back to being any post
on a future date or not. i don't know."* So the question left open is whether a
published post should be re-datable — scheduled again as a *new* post, or
re-opened for editing — and if so, whether that is a copy or the same row.
Nothing should change here until that is decided; the current behaviour is the
conservative reading and is easy to loosen later.

---

## 5c. A published draft still reads "Draft" on its own page

**From:** `feat/linkedin-publish`, 2026-09-03. Small, cosmetic, one line.

post-details' heading is the scheduled date or the word "Draft". A post
published straight from a draft never gets a date (`scheduled_for` stays null by
design), so its own page now says **Draft** above a post that is live on
LinkedIn. The Content page is right about it — it sits on the Published tab
under the day it went out — so this is only the heading.

Found by publishing one for real. Not fixed here because the obvious fix ("show
the published date instead") overlaps the question parked in 5b about what a
published post is allowed to be, and that should be decided once.

---

## 6. Small, unverified, or cosmetic

**From:** `feat/connections-page`, 2026-08-21.

- **Expiry states are computed from a `now` stamped once per request**, so a
  Connections page left open across the 7-day or 60-day boundary won't change
  treatment until it is reloaded. Correct for a boundary that moves once every
  60 days; noted so nobody reports it as a bug.


---


## 7. `GlowPanel`'s info marker is now dead code

**From:** `feat/generate-page`, 2026-08-24.

Every caller passes `showInfoMarker={false}` — Content dropped the marker
earlier, and the Generate page dropped it on 2026-08-24, which was the last
place it rendered. The prop still defaults to `true`, so `components/shared/
glow-panel.tsx` carries a branch (and a Phosphor `Info` import) nothing
reaches. Either flip the default and delete the four now-redundant props, or
remove the prop and the marker outright — a decision about whether that corner
ever gets a real info affordance, not a mechanical cleanup, which is why this
branch left it alone rather than editing a shared component on the way past.

## 8. A regenerate can save on the server while the page rejects it

**From:** `feat/post-accounts`, 2026-08-25.

The regenerate stream now refuses any response that doesn't carry the server's
end-of-stream marker, which stops a truncated stream being written into the
page as if it were finished. The opposite drift is still possible: the server
can persist a new version while the browser gives up (a stall timeout, a
severed connection). The post is safe — the page is just showing the previous
text until it is reloaded.

The toast says so ("The connection dropped" / "Try reloading"), which was the
deliberate cheap fix. The real fix is for the page to re-sync itself, and that
is not a one-liner: `post-details.tsx` seeds `currentPost` from its prop once
and never re-reads it, so `router.refresh()` alone changes nothing, and a
props-to-state effect is the pattern this codebase lints against
(`react-hooks/set-state-in-effect`). Needs a decision on how that page should
hold its data, which is why this branch left it.

Most reachable on the TasteTest path specifically, which persists *before*
responding rather than in the stream's `onEnd`.

## 9. Regeneration cannot be cancelled

**From:** `feat/post-accounts`, 2026-08-25.

A hung generation now gives up on its own after 45s of silence
(`STREAM_STALL_TIMEOUT_MS` in post-details.tsx), so it is no longer
unrecoverable — but until then there is no way to stop it. The Regenerate
button is disabled with a spinner while a run is in flight; turning that into a
stop control, or adding a separate one, is new UI with no export behind it, so
it was flagged rather than invented.

## 10. `maxDuration` on the regenerate route is set for the free tier

**From:** `feat/post-accounts`, 2026-08-25.

`app/api/regenerate-post/route.ts` declares `export const maxDuration = 60`.
Without it the ceiling is whatever the platform defaults to (10-15s on Vercel),
which is shorter than a real generation — so this was a fix, not a tuning. 60s
is the Hobby-tier maximum; raise it alongside the plan if generations ever bump
it. The client's own 45s stall timeout sits just under it deliberately.


---


## 11. A busy day on the dashboard calendar can't open its deck

**From:** `feat/dashboard`, 2026-08-25.

Clicking a day with content on the dashboard calendar
(`components/dashboard/month-calendar-card.tsx`) goes straight to the post when
that day holds exactly one. A day with **several** falls back to the Content
page with the right tab selected — it can't open that day's deck, because
opening a deck needs a chip element on the Content page to fan the cards out
of, and there is no URL that reaches one.

**Do:** teach `components/content/content-view.tsx` to open a deck from a URL
(a `?day=YYYY-MM-DD` param, resolved against the same `dayKeyForPost` grouping
it already uses), then point multi-post days at it. The deck's open animation
measures its origin chip, so the param has to resolve *after* the chips render
— open it from a layout effect once the month sections are mounted, not during
the first paint.

**Why it waited:** `content-view.tsx` and `day-deck.tsx` were both dirty in the
live `post-accounts` worktree while the dashboard was being built. Safe to do
once that has landed.

---

## 12. `lib/ai/generate.test.ts` spends live Gemini quota on every test run

**From:** `feat/post-time`, 2026-08-28.

`npm test` makes a real `generatePost` call against the Gemini free tier. It is
guarded by `it.skipIf(!process.env.GOOGLE_GENERATIVE_AI_API_KEY)`, and the key
*is* in `.env.local`, so it runs every time — including on every `/handoff`
gate run. Once the free tier's 20 requests are used up it fails the whole
suite:

> Quota exceeded for metric:
> `generativelanguage.googleapis.com/generate_content_free_tier_requests`,
> limit: 20, model: gemini-3.6-flash

It first showed up as a bare 30-second timeout (the SDK retrying with backoff
until vitest gave up), which reads as flakiness and cost a couple of rounds of
"is this mine?" before the underlying error surfaced.

**Do:** decide what this test is for. If it's a smoke test of the real API, it
belongs behind an explicit opt-in flag of its own rather than the mere presence
of a key — something like `RUN_LIVE_AI_TESTS=1` — so the default suite is
hermetic and a handoff gate can't fail on someone else's quota. If it's meant
to test the wrapper, mock the model.

**Also seen from `feat/settings-profile`, 2026-08-28**, independently — the two
branches filed this separately and the entries were merged here during
/integrate. That branch saw it first as *flakiness* rather than exhaustion:
failed (30s timeout), failed, passed on clean HEAD, passed again with the same
changes reapplied — pure latency variance, not a regression — before it
started returning the quota error later the same day. It also makes the whole
suite take ~30s instead of ~7s. So the test has two distinct failure modes,
and the slow one is what gets misread as "did I break this?".

**Why it matters:** a gate that goes red at random trains you to ignore it,
`/handoff` runs the suite, and every run costs a request nobody asked for.

**Do (consolidated):** one of — move it behind an explicit opt-in env var
(`RUN_LIVE_AI_TESTS=1`) so the default suite is hermetic; record the response
and assert against a fixture, keeping the live call as a separate manual check
(the only option that also makes the suite fast again); or, as a stopgap only,
raise just this test's timeout (`it(..., { timeout: 60000 })`) so
slow-but-working calls pass. If it is meant to test the wrapper rather than the
API, mock the model.

**Why it waited:** it is not either branch's file and not either branch's
failure; changing the default test suite's behaviour is a decision, not a fix.

---

## 13. `npm run lint` is red on `main`, so `/handoff`'s lint gate can't be met

**From:** `feat/settings-profile`, 2026-08-28.

`npm run lint` reports **19 errors on `main` itself** — `react-hooks/refs` in
`components/ui/switch.tsx` (4) and `components/generate/generate-calendar-column.tsx`
(9), plus `react-hooks/set-state-in-effect` in create-project-modal,
generating-view, onboarding-context and project-sidebar. None are new; the
generate-calendar-column ones are already noted in AGENTS.md as pre-existing.

**Why it matters:** `/handoff` says "do not mark a branch ready with a failing
gate", and that instruction is currently impossible to follow — every branch
inherits a red gate it didn't cause. A gate nobody can pass is a gate everybody
learns to wave through, which is how a *real* failure gets missed.

**Do:** either fix the two rule families (both are mechanical — the `refs` ones
want the value read in a callback ref or effect rather than during render), or
downgrade those two rules to warnings in `eslint.config.mjs` with a comment
pointing here. Fixing is better; `switch.tsx` is four lines and would prove the
pattern for the other nine.

Meanwhile the honest gate is **"no *new* errors"**: this branch took the count
from 19 to 17.


---

## 14. Scheduled-time writes don't go through the save queue

**From:** the /integrate review of `feat/post-time`, 2026-08-28.

The time-of-day writes are optimistic patch + fire-and-forget `updatePost`,
with a 300ms debounce and no queue — `post-details.tsx`'s `handleDateChange`,
`generated-post-card.tsx`, and `day-deck.tsx`'s `handleDateChange`.

The debounce was originally described (in that branch's merge commit) as
removing the ordering hazard. **It does not, and that claim is wrong.** It
guarantees one write in flight *within* a burst. Across bursts it guarantees
nothing: nudge the hour, pause past the debounce, then tap AM/PM, and two
`updatePost` calls are in flight against the same row with no ordering
guarantee between their responses. If the first lands second, the DB keeps the
earlier time while every card shows the later one — until a reload brings the
stale value back.

This is exactly the shape AGENTS.md ships `useSaveQueue` for (hooks/use-save-
queue.ts): at most one save in flight, anything queued behind it collapsed to
the latest payload.

**Do:** route the three call sites through `useSaveQueue`. Not a one-liner —
they're spread across three components that each own their own post state, so
it wants a shared shape rather than three copies.

**Why it waited:** it touches three files in `components/content` and
`components/generate` at once, and the review that found it landed after the
merge.

## Confirm the password-manager fix in Dia

The Add-a-model dialog was autofilling the user's email into **Provider** and a
saved password into **API key** — reported on Dia, never reproduced in Chrome.
The standard fix is applied (`autoComplete="new-password"` on the key field,
`off` plus `data-1p-ignore`/`data-lpignore`/`data-bwignore` on both, and a
`name` that doesn't read as a credential), and the attributes are confirmed
present in the DOM with both fields empty in Chrome.

**Do:** open the dialog in Dia and check nothing is filled. If it still is, the
next lever is structural rather than declarative — the two inputs are adjacent
siblings, which is the shape the heuristic matches. The modal is already
two-stage, so Provider could move into a stage of its own, away from the
password field; a hidden decoy input is the uglier fallback.

**Why it waited:** it can only be verified in a browser this session has no
access to.

---

## 15. `posts.status` is vestigial

**From:** `publish-state` on `main`, 2026-09-01.

`published_at` is now the single truth for published-ness. `status` is read by
nothing that matters, is still accepted by `updatePost`, and its `'published'`
value is written only alongside `published_at` in `publishPost`.

**Do:** once nothing writes it, drop the column and `PostStatus` with it.

**Why it waited:** dropping a column is not additive, and per AGENTS.md a drop
takes down every other running dev server at once. It needs the schema slot and
an otherwise-quiet moment.

---

## 16. Overdue and failed posts have no treatment on the card

**From:** `publish-state` on `main`, 2026-09-01.

`isOverdue` and `hasFailed` (lib/content-grouping.ts) are built and tested, and
nothing renders them. A post whose scheduled moment passed without it going out
now sits in Queued looking exactly like one still waiting its turn — currently
76 of them, all pre-publishing test data.

**Do:** a state on the Kanban card, the deck card and the post-details header.
`hasFailed` should surface `publishError`; `isOverdue` alone is quieter.

**Why it waited:** it belongs with the branch that makes publishing — and
therefore failure — actually possible, so the treatment can be designed against
real states rather than invented ones. Threading it also touches
MonthBoard → KanbanColumn → KanbanPostCard and the shared `GeneratedPostCard`,
which the Generate page also renders.

## LinkedIn's OAuth routes derive their origin from `nextUrl.origin`

`app/api/connections/linkedin/{authorize,callback}/route.ts` build their
redirect URI from `request.nextUrl.origin`, which Next pins to `localhost` in
development regardless of the host requested (see LEARNINGS.md). LinkedIn is
unaffected today only because `localhost` is the spelling registered on its app
— so it happens to be right by coincidence, not by design.

`feat/x-connect` added `resolveRequestOrigin` (lib/x/oauth.ts) for this, and
deliberately did not reach into LinkedIn's routes: publishing work was live in
another worktree at the time, and LinkedIn's flow is not broken. Worth applying
the same helper there when nothing is in flight — it would also let LinkedIn's
connect leg be exercised from a worktree port, which LEARNINGS records as
currently impossible.

## The Connections page can hydrate with stale `last_checked_at`

While wiring X into the liveness check, the client was observed rendering
`social_accounts` rows whose `last_checked_at` was older than what the server
had just fetched for the same navigation (server: the fresh value; client: one
from a previous load, minutes stale). Because `useConnectionLivenessCheck` runs
`isLivenessCheckDue` against that client copy, a connection that is genuinely
due can be judged "checked recently" and skipped for that visit.

Not X-specific — LinkedIn is affected identically, and it predates
`feat/x-connect`. Note a real foreground browser did *not* reproduce it: the
check fired correctly there on first load, so this may be specific to automated
/ backgrounded tabs. Low impact by design: the check is a background nicety, the
server re-runs the same predicate as the authority, and the next visit gets
another go. Worth understanding properly rather than papering over with a
cache-busting query param.

## X: what `feat/x-connect` deliberately did not do

Connecting is finished — OAuth/PKCE, rotating refresh tokens, disconnect with
revocation, liveness, the 280-character constraint and the over-length guard.
What is left:

**Publishing.** There is no `lib/x/publish.ts` and there must not be one until
the user green-lights it (AGENTS.md, "Hard constraint — publishing").
`getLiveXAccessToken` (lib/x/token.ts) is the token source it will use, and is
already exercised by the liveness path. Turning it on means: add `tweet.write`
to `X_SCOPES`, flip the X app's own permission from Read to Read-and-write, and
**plan a reconnect-everyone migration** — changing app permissions invalidates
every existing token, exactly like LinkedIn's scope change. `lib/x/oauth.test.ts`
pins the absence of a write scope and will fail loudly, which is the point.

**The Free tier is a shared pool, not a per-user allowance.** 500 posts and ~100
reads a *month* per Project, across every user of the app — so roughly 100 new
connections a month in total, whatever the signup rate, and 500 posts a month
shared between everyone once publishing exists. Basic is $200/mo. This is a
product/pricing constraint before any public release, not a code change; a
public app will likely also need per-user posting limits enforced in-app so one
heavy user cannot spend everyone's budget.

**280 is applied to everyone by decision, not detection.** X Premium allows
25,000, but the API exposes no reliable tier signal and generating something a
free account cannot publish is the worse failure. If this needs to change it
belongs as a per-account setting (the project owner is on Premium themselves).
See `PLATFORM_LENGTH_LIMITS` in lib/post-length.ts.

**Character counting is approximate and knowingly wrong for links.** It is
`String.length`; X weights by unicode range (most CJK counts double) and
collapses every URL to 23 characters regardless of real length. It therefore
*over*-counts a post containing links — the safe direction, since it nudges
shorter rather than promising a fit that isn't there. Worth replacing with X's
real rules when publishing lands and the number stops being advisory.

**Threads were considered and declined** ("leave as single post, LinkedIn is the
major thing this app"). If revisited: X has no thread endpoint, so a thread is N
sequential `POST /2/tweets` each carrying `reply.in_reply_to_tweet_id`; every
tweet counts separately against both caps; partial failure is the real design
problem, since there is no transaction and a half-published thread is public
with no clean undo; and `posts` has one `content` field and one
`provider_post_id`, so it would need a schema shape it does not have.

**A model that keeps overshooting has no auto-retry.** If a reroll aimed at X
comes back over 280, the switch is refused and the user is told "Still too long
for X" — they must regenerate again themselves. Deliberate for now (an automatic
retry loop spends tokens without asking), but if it turns out to be common, a
single silent retry before reporting would be the obvious fix.

---

## 17. A refusal that records nothing re-selects on every tick

**From:** `feat/linkedin-publish`, 2026-09-03. **This is a decision, not a bug.**

The cron's due query excludes `publish_error is not null`, so a *recorded*
failure is skipped. But the gate refusals — `publishing_disabled`,
`scope_not_granted`, `token_expired` — return `recorded: false` and leave the row
untouched, so they come back every tick. Being oldest, they occupy the entire
`PUBLISH_BATCH_LIMIT` of 5 and starve newer posts behind them.

That is currently *every* connection, since adding `w_member_social` invalidated
every token issued before it.

**The decision:** should a scope refusal mark the post as failed (it wears the
"Didn't send" marker, and a person must act), or should the *account* be excluded
from the due query while its grant is stale (posts wait quietly for a reconnect)?
The first is visible but blames the post for the connection's problem; the second
is quieter but can hide a broken connection indefinitely.

**Why it waited:** not reachable while `PRESTO_ENABLE_LIVE_PUBLISH` is unset —
every post refuses identically, so nothing is starved. Inventing a policy here
without the decision would have been the wrong kind of initiative.

---

## 18. A published post is still editable

**From:** `feat/linkedin-publish`, 2026-09-03. **Product decision.**

A post that has gone out still offers the inline editor, the date pencil and the
account pill, and Regenerate is exposed on the Published tab in the day deck.
Rewriting a post that is already public does not change what is public — the row
and the timeline simply drift apart.

**Do:** decide per control. Plausibly: content and account become read-only once
`publishedAt` is set; the date becomes a display of when it went out; Regenerate
disappears or becomes "draft a follow-up". `isOverdue`/`hasFailed` already exist
to distinguish the states.

**Why it waited:** four controls across `GeneratedPostCard`, the day deck and
post-details, and each wants a different answer. Not reachable while the gate is
shut, since nothing can be published in the first place.

---

## 19. The client/server bundle guard only checks one hop

**From:** `feat/linkedin-publish`, 2026-09-04.

`lib/ai/no-client-sdk.test.ts` regexes for a *direct* `import … from "<server
module>"` inside files marked `"use client"`. A client component importing a
pure module that itself imports a server one is invisible to it.

That is not hypothetical: putting `RECORD_FAILED_PREFIX` in `lib/publish-runner`
and importing it from `lib/publish-failure` — which three client components read
— would have pulled Supabase and the LinkedIn share call into the browser
bundle, with the guard green. Caught by diffing a real build, not by the test.

This branch made the gap wider by adding `lib/linkedin/publish`,
`lib/linkedin/oauth`, `lib/supabase/service` and `lib/publish-runner` to
`SERVER_ONLY`.

**Do:** resolve each client component's import graph transitively (handling the
`@/` alias, relative paths and extension resolution) rather than one hop. A
cheaper stopgap: assert on built output — grep `.next/static/chunks` for
`service_role` / `api.linkedin.com` after a build — though that needs a build,
so it belongs in a separate script rather than the unit suite.

**Why it waited:** it is a change to a shared test harness that every branch
depends on, and the immediate hole is closed. Best done when nothing is in
flight.

---

## X publishing: what `feat/x-publish` deliberately did not do

**From:** `feat/x-publish`, 2026-09-04. Publishing to X by hand is done and
exercised live; these are the parts that were out of scope.

**Scheduling.** `app/api/cron/publish/route.ts` still selects
`platform = 'linkedin'` only. The runner will publish an X post perfectly well —
that one condition is the entire change — but the green-light covered a person
clicking Publish, not a timer doing it for them. AGENTS.md's hard constraint
still governs: ask first, every time. Note §17 below applies to X as well once
it is widened, and more sharply — a stale-grant refusal records nothing and
re-selects on every tick.

**Threads are still declined**, and nothing here moved that. See the
`feat/x-connect` entry above for what building them would actually cost.

**Character counting is still `String.length`.** It over-counts links (X
collapses every URL to 23 characters) and under-counts CJK. It is no longer only
advisory — `publishOnePost` refuses an over-length post outright — so a post
made mostly of links can now be refused when X would have taken it. The safe
direction, but the argument for shipping X's real counting rules is stronger
than it was.

**`token_unavailable` has no retry.** A refresh that fails because X had a bad
moment reports "try again" and leaves the post for a person to re-click. A
single silent retry would be the obvious fix if it turns out to be common.

**The X Free tier's 500 posts/month is shared across every user of the app**,
not per user. Publishing now really does spend from it. Per-user posting limits
enforced in-app are a prerequisite for any public release — noted in the
`feat/x-connect` entry as a pricing constraint, now a real one.

**X publishing is switched off, and turning it on is four things.** X answered
the first real send with `402 credits depleted`: posting costs money, metered
per app across every user of Presto, and the owner's decision was not to pay.
The code is complete and tested — it is the switch that is off. To turn it on:
add `x` to `PUBLISHABLE_PLATFORMS` (lib/post-publish.ts), add `tweet.write` back
to `X_SCOPES` (lib/x/scopes.ts), set the X app's permission to Read-and-write in
X's console, and reconnect (a scope change invalidates every issued token).
Tests in both files will fail first and say so, which is the point. The
271-character draft `f51ec23f-3c78-4ebc-bb8d-ea994b38af5e` is left in place to
send as the proof, and **the tweet id belongs in EXECUTIONS.md** the way the
LinkedIn URNs are.

**Connecting X is withdrawn as well** (`available: false` in `PLATFORMS`,
components/connections/connections-panel.tsx) — the Connect button is plain
"Coming soon" text, which is what the Figma export drew before connecting
shipped. The flow itself is intact; one line re-opens it. Note the Generate
page's account pill disables an unconnected platform on its own, so X is
disabled there too with no code of its own.

**The X app's permission is back on `Read`** (owner confirmed 2026-09-04), so
both locks are in place: the repo asks for no write scope, and the app could not
grant one if it did.

**Two X posts are scheduled and can never go out.** They sit in Queued and will
read "Overdue" forever. Turning them into drafts, or moving them to LinkedIn, is
a call for whoever owns the content — left alone deliberately rather than
rewritten. Six more X posts are drafts, which are harmless. None is published.
Also note some existing X posts run to ~1,459 characters, well over the 280 the
app now enforces at publish time: they predate the limit, and would be refused
rather than truncated.

**Nothing has ever been published to X**, so `lib/x/publish.ts`'s success path
is the one thing here never exercised end to end. Everything up to X receiving
the request is (see EXECUTIONS, 2026-09-04); the 201-and-parse-the-id branch has
only ever been tested against a stub.

**`http://127.0.0.1:3002/api/connections/x/callback` is not a registered
callback on the X app**, which is why the reconnect had to be done on :3003.
Worth registering every worktree port (3001-3005) once, or the next branch that
touches X connecting hits the same wall and reads it as a scope problem — see
LEARNINGS.
