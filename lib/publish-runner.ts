import type { SupabaseClient } from "@supabase/supabase-js"

import { decryptApiKey } from "@/lib/ai/key-crypto"
import {
  checkPublishGate,
  publishTextPost,
  type PublishResult,
} from "@/lib/linkedin/publish"
import { exceedsPlatformLimit } from "@/lib/post-length"
import {
  PUBLISHABLE_PLATFORMS,
  UNLOCKED_PUBLISH_ERROR_FILTER,
} from "@/lib/post-publish"
import { PUBLISH_GRACE_MINUTES } from "@/lib/publish-due"
import {
  RECORD_FAILED_PREFIX,
  type PublishFailure,
} from "@/lib/publish-failure"
import { checkXPublishGate, publishTweet, xTokenFailure } from "@/lib/x/publish"
import { getLiveXAccessToken } from "@/lib/x/token"
import type { PostPlatform } from "@/types/post"

// Publishing one post, once — the single implementation both callers share.
//
// There are two of them and they arrive very differently: the "Publish now"
// button runs as the signed-in user through a server action, and the scheduler
// runs as nobody at all, on a service-role client, for whichever user's post
// happens to be due. Everything *after* "which post" is identical, and it is
// the part that must not be duplicated: the claim below is what stops a post
// going out twice, and a second copy of it that drifts by one condition is a
// double post on someone's real timeline.
//
// It takes the Supabase client rather than making one, which is what lets it
// serve both — and means the caller owns the authorisation question entirely.
// **This function performs no access control of its own beyond scoping every
// query to (id, project_id).** Handed a service-role client it will publish
// anything it is pointed at, which is exactly what the cron needs and exactly
// why the cron's own selection query is the thing to read carefully.

// How long a claim (publish_started_at) is honoured before another attempt may
// take it.
//
// **Derived from the grace window rather than set beside it, and that is the
// whole point.** It was five minutes against a fifteen-minute window, which
// meant a claim went stale ten minutes *before* its post aged out of the due
// window — so a post whose send succeeded but whose record write did not was
// picked up by a later tick and published a second time to a real timeline.
// Two independent constants could drift back into that overlap silently; one
// derived from the other cannot.
//
// The `+ 1` is what guarantees the ordering rather than merely matching it: a
// claim must still be held at the instant its post falls out of the window, so
// the last tick that can see a post is never the tick that can re-claim it.
export const CLAIM_TIMEOUT_MS = (PUBLISH_GRACE_MINUTES + 1) * 60 * 1000

// The marker for "live at LinkedIn, unrecorded here" lives in
// lib/publish-failure.ts — the pure module client components already read —
// and is re-exported so this file stays the obvious place to look for it.
//
// **Holding the claim is not enough on its own, and assuming it was is how the
// first version of this fix stayed broken.** The claim is a *lease* — the
// claim predicate re-grants it after CLAIM_TIMEOUT_MS — so "leave it held"
// only delays a second publish by sixteen minutes. The cron never notices
// because the post has left its due window by then, but the manual "Publish
// now" path does not look at the date at all, so a person clicking it later
// would have re-claimed and re-sent a post already on their timeline.
export { RECORD_FAILED_PREFIX }

// Everything that can stop a publish, including the reasons that are about the
// post rather than the provider. The `PublishFailure` half comes back from the
// gate or the share call itself.
export type PublishOutcomeFailure =
  | PublishFailure
  | "missing"
  | "tryout"
  | "unsupported_platform"
  | "already_published"
  | "claimed"
  | "read_failed"
  // Published for real, but the row could not be updated to say so. Never
  // retryable — see the write itself for why the claim is held, not released.
  | "record_failed"

export type PublishOutcome =
  | {
      ok: true
      postUrn: string
      publishedAt: string
      platform: PostPlatform
    }
  | {
      ok: false
      failure: PublishOutcomeFailure
      // Whether `posts.publish_error` was written. Only an attempt that
      // actually reached the provider sets it — a refusal leaves the row
      // untouched, and a caller mirroring the failure locally must not invent
      // one.
      recorded: boolean
      // Which provider this was about, so the caller can name it. **Required,
      // not optional**: half the failure messages name a provider, and an
      // optional field at a boundary is a suggestion rather than a contract —
      // which is exactly how a URN went missing between this module and the
      // server action once already. Null only where the answer genuinely isn't
      // known yet: the post row could not be read, or it carries a platform
      // this build has no publisher for.
      platform: PostPlatform | null
      // Set only on `record_failed`: the post IS live at the provider under
      // this id even though the row does not say so. The only surviving record
      // of that, so a caller must surface or log it rather than swallow it.
      publishedUrn?: string
    }

// A post's `platform` column is plain text as far as this query is concerned,
// so it is narrowed here rather than trusted.
//
// **The list itself is lib/post-publish.ts's**, shared with the client
// predicate that decides whether to offer the control at all — the server must
// refuse exactly what the UI declines to offer, and two copies of that would
// drift. X is deliberately absent from it; `sendPost` below still has a
// complete X branch, unreachable until the list says otherwise. That is the
// same state lib/linkedin/publish.ts sat in for months before LinkedIn
// publishing was green-lit.
function publishablePlatform(value: unknown): PostPlatform | null {
  return PUBLISHABLE_PLATFORMS.includes(value as PostPlatform)
    ? (value as PostPlatform)
    : null
}

export async function publishOnePost(
  supabase: SupabaseClient,
  input: { projectId: string; postId: string },
  now: Date = new Date()
): Promise<PublishOutcome> {
  // Scoped to the project as well as the id. For the action, RLS scopes to the
  // caller's own rows but one person owns several projects, so `id` alone would
  // publish project A's post through project B's connection. For the cron there
  // is no RLS at all, which makes the pairing the only thing keeping the two
  // straight.
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, platform, content, is_tryout, published_at")
    .eq("id", input.postId)
    .eq("project_id", input.projectId)
    .maybeSingle()

  if (postError) {
    return { ok: false, failure: "read_failed", recorded: false, platform: null }
  }
  if (!post) {
    return { ok: false, failure: "missing", recorded: false, platform: null }
  }

  const platform = publishablePlatform(post.platform)

  // A "Try out" post was written against a stand-in account, not a real one. It
  // borrows a real platform value (see types/post.ts), so without this it would
  // resolve to the user's genuine connection and publish under their name.
  if (post.is_tryout) {
    return { ok: false, failure: "tryout", recorded: false, platform }
  }

  if (!platform) {
    return {
      ok: false,
      failure: "unsupported_platform",
      recorded: false,
      platform: null,
    }
  }

  // Too long for where it is going. Grouped with the checks about the post
  // rather than with the gate, since it is a fact about the content and needs
  // no connection to answer.
  //
  // **The client-side guard is not enough, and this is not belt-and-braces.**
  // `exceedsPlatformLimit` is applied where a post is *moved* to a platform
  // (post-details, the deck, the generating grid), which cannot see a post that
  // was written for X and came back over the limit, or one edited past it
  // afterwards. Without this, that post reaches X, is refused with a 403 that
  // reads exactly like every other 403, and spends from a posting budget shared
  // across every user of the app.
  //
  // The count is `String.length` and knowingly over-counts links (see
  // lib/post-length.ts), so this can refuse a post X would have accepted. That
  // is the safe direction: the remedy is shortening a post, not an unsendable
  // one going out.
  if (exceedsPlatformLimit(post.content, platform)) {
    return { ok: false, failure: "too_long", recorded: false, platform }
  }

  // Already out. Checked here for a useful answer; the claim below is what
  // actually makes this safe, since two requests can both pass this point.
  if (post.published_at !== null) {
    return { ok: false, failure: "already_published", recorded: false, platform }
  }

  // `id` is selected for X's sake: its token is not read off this row but
  // fetched through lib/x/token.ts, which needs the account to refresh.
  const { data: account, error: accountError } = await supabase
    .from("social_accounts")
    .select("id, provider_account_id, scope, expires_at, encrypted_access_token")
    .eq("project_id", input.projectId)
    .eq("platform", platform)
    .maybeSingle()

  if (accountError) {
    return { ok: false, failure: "read_failed", recorded: false, platform }
  }
  if (!account) {
    return { ok: false, failure: "not_connected", recorded: false, platform }
  }

  const publishable = {
    providerAccountId: account.provider_account_id,
    scope: account.scope,
    expiresAt: new Date(account.expires_at),
  }

  // Gated *before* any token is obtained, so a refused publish never puts a
  // plaintext access token in memory at all — and, on X, never spends a
  // single-use refresh token on a post that was never going to go out. Each
  // platform's own publish entry point checks its gate again: the duplication
  // is deliberate, this one is about not fetching a token, that one is about
  // not making the request.
  //
  // The two gates are siblings rather than one function because they disagree
  // on expiry, and only on that: LinkedIn's 60-day token cannot be renewed, so
  // a lapsed one is a refusal; X's lasts two hours and is renewed on almost
  // every call, so `expires_at` is stale by design and gating on it would
  // refuse nearly every publish. See checkXPublishGate.
  const gate =
    platform === "linkedin"
      ? checkPublishGate(publishable, now)
      : checkXPublishGate(publishable)

  if (!gate.allowed) {
    return { ok: false, failure: gate.failure, recorded: false, platform }
  }

  // Claim the post before calling out, so a double click, a retry, or two cron
  // ticks overlapping cannot produce two live posts. The guard is the
  // `.is("published_at", null)` and stale-claim window *inside the update*, not
  // a read beforehand: a check-then-act pair leaves both requests believing they
  // won. Whoever the database hands a row to owns the attempt; everyone else
  // gets nothing back and stops.
  const staleBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS).toISOString()
  const { data: claimed, error: claimError } = await supabase
    .from("posts")
    .update({ publish_started_at: now.toISOString() })
    .eq("id", input.postId)
    .eq("project_id", input.projectId)
    .is("published_at", null)
    .or(`publish_started_at.is.null,publish_started_at.lt.${staleBefore}`)
    // Never re-claim a post already known to be live. Unlike the stale-claim
    // window above this has no expiry, which is the point: every other reason
    // a claim is held is recoverable by waiting, and this one is not.
    //
    // **The `is.null` half is not belt-and-braces, it is the whole thing.**
    // PostgREST renders `.not("publish_error", "like", …)` as a bare
    // `NOT (col LIKE …)`, and in SQL that is NULL — not true — for a NULL
    // column. `publish_error` is NULL on every post that has never failed,
    // i.e. essentially all of them, so the bare form matched *zero* rows and
    // silently killed publishing outright: every claim returned nothing and
    // every post reported "already being published". Measured against the live
    // database at 0 of 311 rows. The null-safe form passes 311.
    //
    // Shared with `updatePost`'s own lock rather than written twice: this
    // string is one edit away from re-creating that outage, and two copies of
    // it are two chances to make it. Same predicate, same reason, one source.
    .or(UNLOCKED_PUBLISH_ERROR_FILTER)
    .select("id")
    .maybeSingle()

  if (claimError) {
    return { ok: false, failure: "read_failed", recorded: false, platform }
  }
  if (!claimed) {
    return { ok: false, failure: "claimed", recorded: false, platform }
  }

  // The send, and the only place the two platforms genuinely differ.
  //
  // **The claim is already held here, which is why the token is fetched now
  // and not earlier.** On X that fetch usually spends a rotating, single-use
  // refresh token; doing it before the claim would burn one on a post another
  // request had already taken. LinkedIn's token is simply decrypted off the
  // row, which is the whole of its token story.
  //
  // Both return the same shape — `{ ok, postUrn | postId, failure }` — except
  // for the field naming the created post, normalised here so everything below
  // this point stays platform-agnostic.
  const result = await sendPost({
    supabase,
    platform,
    account,
    publishable,
    content: post.content,
    now,
  })

  // Live, but unnameable: LinkedIn accepted the share and gave back no URN.
  // Handled before the ordinary failure branch below because it must NOT
  // release the claim — the post exists, and offering it for retry would put a
  // second copy on the timeline. Same treatment as a failed `published_at`
  // write, minus the URN there is no way to know: a permanent marker, and the
  // claim left held.
  if (!result.ok && result.failure === "published_without_urn") {
    const { error: markError } = await supabase
      .from("posts")
      .update({ publish_error: RECORD_FAILED_PREFIX })
      .eq("id", input.postId)
      .eq("project_id", input.projectId)

    return {
      ok: false,
      failure: "record_failed",
      recorded: !markError,
      platform,
    }
  }

  if (!result.ok) {
    // Release the claim and record why, so the post reads as failed rather than
    // sitting in the queue looking untouched (see hasFailed in
    // lib/content-grouping.ts, and the card's own marker).
    //
    // Error-checked like the success write below. Nothing was published on this
    // path, so a failed write here cannot duplicate anything — but it would
    // leave the post wearing "Overdue" with no "Didn't send" marker and no
    // reason, which is precisely the silent state the publish_error column
    // exists to prevent. `recorded` reports what actually happened so the
    // caller does not mirror a failure the row never received.
    const { error: releaseError } = await supabase
      .from("posts")
      .update({ publish_started_at: null, publish_error: result.failure })
      .eq("id", input.postId)
      .eq("project_id", input.projectId)

    return {
      ok: false,
      failure: result.failure,
      recorded: !releaseError,
      platform,
    }
  }

  // The one place published-ness is recorded. Every tab, chip and dashboard
  // figure reads `published_at` from here — nothing derives it from the clock.
  // `provider_post_id` goes in the same write because a database constraint
  // requires the pair: a post marked published with no id for the thing it
  // became is exactly the state that makes the column untrustworthy.
  const publishedAt = now.toISOString()

  const { error: recordError } = await supabase
    .from("posts")
    .update({
      status: "published",
      published_at: publishedAt,
      provider_post_id: result.postUrn,
      publish_started_at: null,
      publish_error: null,
    })
    .eq("id", input.postId)
    .eq("project_id", input.projectId)

  // **The post is live and we failed to write that down.** This is the one
  // failure that must never be retried: the share call already succeeded, so
  // trying again publishes the same post twice. It used to be unchecked, which
  // left the row reading `published_at: null` — indistinguishable from a post
  // that never went out, and therefore re-claimable by the next tick.
  //
  // The claim is deliberately *left in place* rather than released: a held
  // claim is the only thing standing between this row and a second send, and
  // an unreleased one merely delays this post rather than duplicating it. It
  // does mean a row can sit claimed until someone looks, which is the right
  // way round for a failure nobody can undo.
  //
  // The URN goes into the error text because it is the only surviving record
  // that this post is live, and losing it means nobody can reconcile the row
  // against the real timeline by hand.
  if (recordError) {
    // Last durable act available: mark the row so no path can ever claim it
    // again, and keep the URN inside that marker. This is a smaller write than
    // the one that just failed — no `published_at`, so it cannot trip the
    // published-needs-a-provider-id constraint — which gives it a real chance
    // of landing when the larger one did not.
    //
    // The claim is left set as well. Belt and braces: the marker is what makes
    // the block permanent, the held claim is what covers the sixteen minutes
    // before this write is even attempted again.
    const { error: markError } = await supabase
      .from("posts")
      .update({ publish_error: `${RECORD_FAILED_PREFIX}${result.postUrn}` })
      .eq("id", input.postId)
      .eq("project_id", input.projectId)

    return {
      ok: false,
      failure: "record_failed",
      // True only if the marker landed. False means nothing durable records
      // that this post is live, and the id below is the only copy anywhere.
      recorded: !markError,
      platform,
      publishedUrn: result.postUrn,
    }
  }

  return { ok: true, postUrn: result.postUrn, publishedAt, platform }
}

// One send, whichever platform it is for. Returns LinkedIn's own result shape
// — the X branch renames `postId` to `postUrn` — so the record-keeping below
// the call site has one thing to handle rather than two.
//
// A `published_without_urn` from either provider means the same thing and gets
// the same treatment: the post is live and unnameable, so the claim is held and
// a permanent marker written. The two arrive differently (LinkedIn's URN is a
// response header, X's id is a field in the body) and that difference is
// entirely inside each platform's own module.
async function sendPost(input: {
  supabase: SupabaseClient
  platform: PostPlatform
  account: { id: string; encrypted_access_token: string }
  publishable: { providerAccountId: string; scope: string; expiresAt: Date }
  content: string
  now: Date
}): Promise<PublishResult> {
  if (input.platform === "linkedin") {
    return publishTextPost({
      account: input.publishable,
      accessToken: decryptApiKey(input.account.encrypted_access_token),
      content: input.content,
      now: input.now,
    })
  }

  // X's stored access token lives two hours, so it is almost always stale and
  // this is a refresh rather than a read. It writes the rotated refresh token
  // back before returning, and marks the row revoked if X says the grant is
  // dead — so a failure here is already reflected on the Connections page.
  const token = await getLiveXAccessToken(
    input.supabase,
    input.account.id,
    input.now.getTime()
  )

  if (!token.ok) return { ok: false, failure: xTokenFailure(token.failure) }

  const result = await publishTweet({
    account: input.publishable,
    accessToken: token.accessToken,
    content: input.content,
  })

  return result.ok ? { ok: true, postUrn: result.postId } : result
}
