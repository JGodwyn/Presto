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
  // most expects to see named.
  if (post.publishedAt !== null) return "already_published"

  // Live at the provider, but the row's own `published_at` write failed — so
  // the check above cannot see it and only the marker can. Without this the
  // control stays enabled on a post that is already on someone's timeline; the
  // claim predicate refuses the attempt, but the user is told "that post is
  // already being published", which is the third different story one post gets
  // told about itself. See RECORD_FAILED_PREFIX in lib/publish-failure.ts.
  if (isRecordFailure(post.publishError)) return "already_published"

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
