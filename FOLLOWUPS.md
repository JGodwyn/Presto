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

## 5. Prerequisites for the publishing phase

**From:** `feat/connections-page`, 2026-08-21. **Blocked on the user explicitly
green-lighting publishing** — see AGENTS.md, "Hard constraint — publishing".
Nothing here should be built speculatively.

**Partly built as of 2026-08-31** (`feat/connection-expiry`, explicitly
authorized): `lib/linkedin/publish.ts` + `publish-actions.ts` hold the share
path behind a two-key gate that is refused-by-default, and nothing calls them.
The scope flip below is still the un-taken step, and is still the destructive
one. The author URN needed no migration after all — it has been stored as
`social_accounts.provider_account_id` since this branch wrote it.

Two facts confirmed against LinkedIn's docs that will shape that work:

- **Adding `w_member_social` invalidates every token already issued.** Per
  LinkedIn: "if you request a different scope than the previously granted scope,
  all the previous access tokens are invalidated." So switching publishing on is
  a *migration*, not a scope-string edit: every connected account in the app
  must reconnect, and the UI has to say so rather than silently 401. The
  existing expired treatment is the obvious thing to reuse.
- **Granted scopes come back comma-delimited** (`email,openid,profile`) even
  though they're sent space-delimited. Anything checking whether a scope was
  granted must split on both, or it will report a granted scope as missing.
  Noted in `lib/linkedin/oauth.ts` where the value is stored.

Also unbuilt by design: **X (Twitter)**, which renders as "Coming soon" with no
control, and has a `platform` value reserved in the `social_accounts` check
constraint but no flow behind it.

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
