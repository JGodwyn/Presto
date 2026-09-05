import { PLATFORM_LABELS } from "@/lib/post-account"
import { exceedsPlatformLimit } from "@/lib/post-length"
import { isRecordFailure } from "@/lib/publish-failure"
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

// **The single list of platforms this app will actually publish to**, read by
// the client predicate below *and* by lib/publish-runner.ts, so the control the
// UI offers and the send the server performs cannot disagree.
//
// X is not on it, and its absence is a decision rather than missing work:
// lib/x/publish.ts is complete and was exercised against the live API on
// 2026-09-04, but X answered the real send with `402 credits depleted`.
// Posting through X's v2 API is metered **per app, across every user of
// Presto** — one person's click spends the app owner's budget — and the
// owner's decision was not to pay for that. So X publishing is coming soon,
// not shipped, and `publishBlockedReason` reports it as such.
//
// Turning it on is: this list, `X_SCOPES` (lib/x/scopes.ts), the X app's own
// permission in X's console, and a reconnect.
export const PUBLISHABLE_PLATFORMS: readonly PostPlatform[] = ["linkedin"]

export type PublishBlockedReason =
  | "already_published"
  | "tryout"
  // No publisher for this platform — today that means X, whose publishing is
  // built but switched off (see PUBLISHABLE_PLATFORMS). The one blocked reason
  // that still shows a control, disabled: see `publishComingSoon`.
  | "platform_unsupported"
  | "too_long"
  | "not_connected"

// What a post needs from the outside world to be publishable at all. Taken as
// the connected accounts rather than a bare platform list so callers hand over
// what they already have (every surface that renders a post card fetches
// these for the account pill).
export function publishBlockedReason(
  post: Pick<
    Post,
    "platform" | "isTryout" | "publishedAt" | "publishError" | "content"
  >,
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

  // Longer than the platform allows. The server refuses this too (see
  // publishOnePost) — offering the control here would spend a round trip and,
  // on X, a request against a posting budget shared across every user of the
  // app, to be told something the character count on the card already says.
  if (exceedsPlatformLimit(post.content, post.platform)) return "too_long"

  // No account to publish through. Note this asks only whether the platform is
  // connected, not whether that connection is *alive*: an expired or revoked
  // one still fails, but it fails with "reconnect it and try again", which is
  // a more useful thing to be told than a control quietly not being there.
  if (!accounts.some((account) => account.platform === post.platform)) {
    return "not_connected"
  }

  return null
}

/**
 * Whether the Publish control should be shown but **disabled**, rather than not
 * shown at all.
 *
 * The distinction is the whole reason call sites ask for the reason rather than
 * the boolean. A post that has already gone out, or a try-out written against a
 * stand-in account, has nothing to offer — the control is simply absent, which
 * is what it has always done. A post whose platform *will* be publishable is a
 * different story: leaving no trace of it makes X posts look broken beside
 * LinkedIn ones, and invites the question this answers.
 */
export function publishComingSoon(
  post: Pick<
    Post,
    "platform" | "isTryout" | "publishedAt" | "publishError" | "content"
  >,
  accounts: ConnectedSocialAccount[]
): boolean {
  return publishBlockedReason(post, accounts) === "platform_unsupported"
}

/** What the disabled control says it is waiting for. */
export function publishComingSoonLabel(platform: PostPlatform): string {
  return `Publishing to ${PLATFORM_LABELS[platform]} is coming soon`
}

export function canAttemptPublish(
  post: Pick<
    Post,
    "platform" | "isTryout" | "publishedAt" | "publishError" | "content"
  >,
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
