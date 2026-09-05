import { isRecordFailure, RECORD_FAILED_PREFIX } from "@/lib/publish-failure"
import type { ConnectedSocialAccount } from "@/types/social-account"
import type { Post, PostPlatform } from "@/types/post"

// When the app offers to publish a post, and why it doesn't.
//
// One predicate, because three surfaces ask the question — the card's actions
// menu, the post's own page, and (later) the scheduler deciding what is due —
// and a control that appears in one place but not another reads as a bug. It
// mirrors `publishPost`'s own refusals (app/projects/[projectId]/generate/
// publish-actions.ts) for exactly the reasons the client can see for itself;
// the server re-checks all of them regardless, since a client predicate is a
// courtesy, never a guarantee.
//
// **Not checked here: the gate.** `PRESTO_ENABLE_LIVE_PUBLISH` and the granted
// scope are server-only facts, and deliberately so — hiding the control when
// publishing is switched off would make a refused publish invisible instead of
// explained. The button is offered, the attempt is refused, and the refusal
// says which key is shut.

// Publishing is built for LinkedIn alone. X has a `platform` value reserved
// and no flow behind it, so a post written for it can be scheduled and edited
// but not sent.
const PUBLISHABLE_PLATFORMS: readonly PostPlatform[] = ["linkedin"]

export type PublishBlockedReason =
  | "already_published"
  | "tryout"
  | "platform_unsupported"
  | "not_connected"

// What a post needs from the outside world to be publishable at all. Taken as
// the connected accounts rather than a bare platform list so callers hand over
// what they already have (every surface that renders a post card fetches
// these for the account pill).
export function publishBlockedReason(
  post: Pick<Post, "platform" | "isTryout" | "publishedAt" | "publishError">,
  accounts: ConnectedSocialAccount[]
): PublishBlockedReason | null {
  // Checked first: an already-published post is the one state where offering
  // the control could produce a *second* live post, and the reason a reader
  // most expects to see named. Asked through `isPostLocked` so this and the
  // read-only treatment below can never disagree about which posts are out.
  if (isPostLocked(post)) return "already_published"

  // A "Try out" post was written against a stand-in account. It borrows a real
  // platform value, so without this it would resolve to the member's genuine
  // connection and go out under their name — see types/post.ts.
  if (post.isTryout) return "tryout"

  if (!PUBLISHABLE_PLATFORMS.includes(post.platform)) {
    return "platform_unsupported"
  }

  // No account to publish through. Note this asks only whether the platform is
  // connected, not whether that connection is *alive*: an expired or revoked
  // one still fails, but it fails with "reconnect it and try again", which is
  // a more useful thing to be told than a control quietly not being there.
  if (!accounts.some((account) => account.platform === post.platform)) {
    return "not_connected"
  }

  return null
}

export function canAttemptPublish(
  post: Pick<Post, "platform" | "isTryout" | "publishedAt" | "publishError">,
  accounts: ConnectedSocialAccount[]
): boolean {
  return publishBlockedReason(post, accounts) === null
}

// May this post still be changed here? **No, once it is live.**
//
// The provider owns the copy people are reading, and nothing in this app can
// edit or recall it — so a screen that still offers the content editor, the
// date pencil or the account pill is offering to make the row and the real
// post drift apart silently. Four controls across three surfaces ask this
// question (post-details, the day deck, the generated card and its actions
// menu), which is why it is one predicate rather than four readings of
// `publishedAt`.
//
// Two states count as live, and both are here so no caller has to remember
// the second:
//
//   published_at set        the ordinary case, recorded by publishOnePost
//   record_failed: marker   the share went out and the row's own write of it
//                           failed, so `published_at` is still null and only
//                           the marker knows (lib/publish-failure.ts). A post
//                           in this state is just as public as the first.
//
// Deliberately platform-agnostic: it reads `publishedAt`, never `platform`.
// X publishing is being built alongside this and inherits the whole treatment
// for free — a post that has gone out is a post that has gone out.
//
// The sibling of `canAttemptPublish` above, and `publishBlockedReason` asks it
// too: "may this go out" and "may this still change" must agree about what
// "already out" means, and one function is how that is guaranteed rather than
// hoped for. Regenerate is the one control this does *not* simply switch off —
// it drafts a follow-up instead, since riffing on a post that landed well
// changes nothing about the live one (`draftFollowUpPost`,
// app/projects/[projectId]/generate/post-actions.ts).
export function isPostLocked(
  post: Pick<Post, "publishedAt" | "publishError">
): boolean {
  return post.publishedAt !== null || isRecordFailure(post.publishError)
}

// The lock, expressed as PostgREST filters for a server action that must refuse
// a write rather than merely hide a control. Apply BOTH to the statement:
//
//   .is("published_at", null).or(UNLOCKED_PUBLISH_ERROR_FILTER)
//
// **Applied to the UPDATE itself, never as a read followed by a write.** The
// reported race is exactly that gap: the details page holds a load-time
// snapshot, so if the scheduler publishes while that page is open, a
// fetch-then-update still sees an unpublished row and overwrites content that
// is already live. A conditional update has no such window — the database
// decides, and a row either comes back or it does not.
//
// The NULL case is spelled out, and that is load-bearing rather than defensive:
// PostgREST renders a bare `.not(col, "like", …)` as `NOT (col LIKE …)`, which
// is NULL — not true — for a NULL column, so it silently excludes every row
// that has never failed. That mistake once disabled publishing outright; see
// LEARNINGS.md.
export const UNLOCKED_PUBLISH_ERROR_FILTER =
  `publish_error.is.null,publish_error.not.like.${RECORD_FAILED_PREFIX}*` as const

