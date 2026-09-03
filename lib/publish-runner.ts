import type { SupabaseClient } from "@supabase/supabase-js"

import { decryptApiKey } from "@/lib/ai/key-crypto"
import {
  checkPublishGate,
  publishTextPost,
  type PublishFailure,
} from "@/lib/linkedin/publish"
import { PUBLISH_GRACE_MINUTES } from "@/lib/publish-due"
import { RECORD_FAILED_PREFIX } from "@/lib/publish-failure"

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
  | { ok: true; postUrn: string; publishedAt: string }
  | {
      ok: false
      failure: PublishOutcomeFailure
      // Whether `posts.publish_error` was written. Only an attempt that
      // actually reached LinkedIn sets it — a refusal leaves the row untouched,
      // and a caller mirroring the failure locally must not invent one.
      recorded: boolean
      // Set only on `record_failed`: the post IS live at LinkedIn under this
      // URN even though the row does not say so. The only surviving record of
      // that, so a caller must surface or log it rather than swallow it.
      publishedUrn?: string
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

  if (postError) return { ok: false, failure: "read_failed", recorded: false }
  if (!post) return { ok: false, failure: "missing", recorded: false }

  // A "Try out" post was written against a stand-in account, not a real one. It
  // borrows a real platform value (see types/post.ts), so without this it would
  // resolve to the user's genuine connection and publish under their name.
  if (post.is_tryout) return { ok: false, failure: "tryout", recorded: false }

  if (post.platform !== "linkedin") {
    return { ok: false, failure: "unsupported_platform", recorded: false }
  }

  // Already out. Checked here for a useful answer; the claim below is what
  // actually makes this safe, since two requests can both pass this point.
  if (post.published_at !== null) {
    return { ok: false, failure: "already_published", recorded: false }
  }

  const { data: account, error: accountError } = await supabase
    .from("social_accounts")
    .select("provider_account_id, scope, expires_at, encrypted_access_token")
    .eq("project_id", input.projectId)
    .eq("platform", "linkedin")
    .maybeSingle()

  if (accountError) return { ok: false, failure: "read_failed", recorded: false }
  if (!account) return { ok: false, failure: "not_connected", recorded: false }

  const publishable = {
    providerAccountId: account.provider_account_id,
    scope: account.scope,
    expiresAt: new Date(account.expires_at),
  }

  // Gated *before* the token is decrypted, so a refused publish never puts a
  // plaintext access token in memory at all. publishTextPost checks the same
  // gate again on its own — the duplication is deliberate: this one is about
  // not decrypting, that one is about not requesting.
  const gate = checkPublishGate(publishable, now)
  if (!gate.allowed) {
    return { ok: false, failure: gate.failure, recorded: false }
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
    .or(`publish_error.is.null,publish_error.not.like.${RECORD_FAILED_PREFIX}*`)
    .select("id")
    .maybeSingle()

  if (claimError) return { ok: false, failure: "read_failed", recorded: false }
  if (!claimed) return { ok: false, failure: "claimed", recorded: false }

  const result = await publishTextPost({
    account: publishable,
    accessToken: decryptApiKey(account.encrypted_access_token),
    content: post.content,
    now,
  })

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

    return { ok: false, failure: result.failure, recorded: !releaseError }
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
      // that this post is live, and the URN below is the only copy anywhere.
      recorded: !markError,
      publishedUrn: result.postUrn,
    }
  }

  return { ok: true, postUrn: result.postUrn, publishedAt }
}
