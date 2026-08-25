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

## 1. Nothing consumes a connected social account yet

**From:** `feat/connections-page`, 2026-08-21.

Connecting LinkedIn now stores a real, working account
(`public.social_accounts`, one row per project+platform) — and changes nothing
downstream. The Generate page's social-account pill is still the hardcoded
placeholder list it always was.

**Do:** feed `fetchSocialAccounts(supabase, projectId)` (lib/supabase/queries.ts)
into the account pill in `components/generate/generate-card.tsx`, the same way
that file already merges user AI models into the model pill — it fetches with
the *browser* Supabase client, since its page is a client component, and
queries.ts accepts either client. Decide what the pill shows when a project has
no connection at all (today's placeholders imply one always exists) and when the
only connection is expired.

**Why it waited:** `generate-card.tsx` belonged to the live `feat/generate-page`
worktree while connections was being built. Editing it there would have
guaranteed a conflict in a file neither branch owned outright.

**Gotcha:** the account pill's persisted value has the same latent bug
generate-card.tsx already fixed once for models — a stored id whose row has
since been deleted must not be non-null-asserted into a render. Reuse that
pattern (an explicit `loaded` flag, not "the list is empty").

---

## 2. A token revoked at LinkedIn's end is invisible to us

**From:** `feat/connections-page`, 2026-08-21.

If a member revokes Presto's access from LinkedIn's own settings, the row here
keeps reading green until its 60 days run out. Nothing pings LinkedIn to
confirm the token still works, so the first symptom is a 401 from whatever
finally uses it.

**Do:** treat a 401 from any LinkedIn call as "this connection is dead" and mark
the row — most likely a `status` column mirroring how `user_ai_models` flips to
`'error'` after a failed BYOK generation, with the Connections row rendering the
existing expired treatment (red strip, green Reconnect) for it.

**Why it waited:** there is nothing that calls LinkedIn on a schedule yet, so
there is no natural moment to notice. This lands most cheaply alongside item 1 —
the first real *use* of a token is what makes the check meaningful.

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

## 2. The dashboard's "Try out" platform row is a placeholder

**From:** `feat/dashboard`, 2026-08-25. Revised 2026-08-25 once
`feat/post-accounts` landed.

`components/dashboard/posting-about-card.tsx` renders a third platform row —
"Try out", with the export's Eyes glyph and Purple50/600 bar — hardcoded to
`count={0}`. Everything around it is real: LinkedIn and X read their counts
from `platformSplit()`.

**The spelling is settled:** "Try out" everywhere, per direct instruction. The
row was originally coined "TryOn" on this branch while the other one was still
in flight; it now matches `TRY_OUT_ACCOUNT_ID`, `isTryout` and `is_tryout`.

**Do:** this entry's original plan was wrong, and the correction matters.
`feat/post-accounts` has landed and it did **not** add a member to
`PostPlatform` — a try-out post carries `platform: "linkedin"` with a separate
`isTryout: boolean` alongside (`social_accounts` is unique per
`(project_id, platform)`, so the platform column still names a real account).
So `platformSplit()` does *not* pick this row up automatically: it keys on
`PostPlatform`, and every try-out post is already being counted under LinkedIn.

Wiring it therefore means changing what LinkedIn reports, not just filling in a
zero: `platformSplit()` needs to partition on `post.isTryout` first and count
the rest by platform, and `lib/dashboard-summary.test.ts` needs a case pinning
that a try-out post lands in the try-out bucket and *not* in LinkedIn's.

**Why it's still waiting:** it changes a number the dashboard already reports,
which is a product call rather than a mechanical fix.


---

## 3. A busy day on the dashboard calendar can't open its deck

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
