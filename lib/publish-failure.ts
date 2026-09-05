import { PLATFORM_LABELS } from "@/lib/post-account"
import type { PostPlatform } from "@/types/post"

// What a publish failure says to the person who has to do something about it.
//
// Kept out of both the action and the components so the server's toast and the
// card's own treatment can never describe the same failure differently — and
// pure, so a client component can read it without dragging a share call into
// the bundle.

// Every way publishing can decline or fail, as a short code the caller maps to
// copy. The first five are *refusals* — the gate said no, or there was no
// usable token, and nothing left this process; the last two mean a request was
// actually made.
//
// **Defined here rather than in either platform's publish module**, and the
// direction matters: this file is imported by client components, so it must sit
// below lib/linkedin/publish.ts and lib/x/publish.ts, never above them. Both
// import the type from here; lib/linkedin/publish.ts re-exports it for the
// readers that have always found it there.
export type PublishFailure =
  | "publishing_disabled"
  | "scope_not_granted"
  | "token_expired"
  | "not_connected"
  // No working access token could be obtained — the credentials aren't
  // configured, or the provider couldn't be reached to renew one. X-only in
  // practice: LinkedIn's token is read straight off the row, while X's is
  // refreshed on almost every call (lib/x/token.ts). Deliberately not
  // `token_expired`, which tells the user to reconnect: this is usually a bad
  // moment rather than a dead connection, and the next attempt may just work.
  | "token_unavailable"
  // Longer than the platform allows. A *refusal*, not a rejection: the request
  // is never made. X answers an over-length tweet with a 403 that reads
  // identically to half a dozen other refusals, and every attempt spends from a
  // posting budget shared across the whole app (FOLLOWUPS) — so the limit is
  // checked here, where the number is known, rather than discovered there.
  | "too_long"
  // The provider's API account has run out of credits or quota — X answers
  // `402 credits depleted`. **Not retryable**, and that is the whole reason it
  // is not `publish`: nothing about the post is wrong, and no number of
  // attempts will change the answer until somebody tops the account up.
  | "quota_exhausted"
  // Rate-limited (429). Retryable, but not immediately — the opposite of the
  // above, and equally not a verdict on the post. Near-certain on X's Free
  // tier, whose budget is shared across every user of the app.
  | "rate_limited"
  | "network"
  | "publish"

// Marks a post that IS live at the provider but whose row could not be updated
// to say so. The provider's own id is appended, so every test on it is a prefix
// test.
//
// **Defined here, in the pure module, and imported by the runner — not the
// reverse.** This file is read by client components (the card's status marker,
// the deck, post details); `lib/publish-runner` reaches Supabase and the share
// call and is on no-client-sdk.test.ts's server-only list. Importing the runner
// from here to borrow one string would have pulled all of that into the browser
// bundle, which is the exact trap lib/ai/model-constants.ts exists to avoid.
export const RECORD_FAILED_PREFIX = "record_failed:"

// The placeholder every message that names a provider carries instead of
// naming one. Filled in from the post's own platform at the point of display —
// there is no sensible default, because "Couldn't reach LinkedIn" shown after a
// failed tweet is simply false.
const PROVIDER = "{provider}"

// Templates, not finished strings — hence the name. Anything reading one
// straight out of this map and showing it to a user leaks `{provider}`, which
// is the point of the rename: the old `PUBLISH_FAILURE_MESSAGES` would have
// gone on compiling while quietly showing the wrong provider's name.
export const PUBLISH_FAILURE_TEMPLATES: Record<PublishFailure, string> = {
  publishing_disabled:
    "Publishing to a live account is switched off for this app.",
  scope_not_granted: `This connection doesn't have permission to post. Reconnect the account and try again.`,
  token_expired: "That connection has expired. Reconnect it and try again.",
  not_connected: "There's no connected account to publish this to.",
  token_unavailable: `Couldn't get a working connection to ${PROVIDER}. Try again, and reconnect the account if it keeps failing.`,
  too_long: `This post is longer than ${PROVIDER} allows. Shorten it and try again.`,
  quota_exhausted: `${PROVIDER} has run out of API credits for this app, so nothing can publish until that's topped up. Trying again won't help.`,
  rate_limited: `${PROVIDER} is rate-limiting this app right now. Wait a few minutes and try again.`,
  network: `Couldn't reach ${PROVIDER}. Check your connection and try again.`,
  publish: `${PROVIDER} wouldn't accept this post. Try again.`,
}

export function fillProvider(
  template: string,
  platform: PostPlatform
): string {
  return template.split(PROVIDER).join(PLATFORM_LABELS[platform])
}

// `posts.publish_error` is a text column with no constraint, written from this
// union — but a row could carry a code from an older build, or one that has
// since been renamed. So a lookup miss is a real possibility rather than a
// theoretical one, and it degrades to something true rather than "undefined".
//
// The platform is required, not optional: every caller has the post in hand,
// and an optional field at a boundary is a suggestion rather than a contract —
// which is exactly how a URN went missing from this module's other half.
export function publishFailureMessage(
  code: string | null,
  platform: PostPlatform
): string | null {
  if (code === null) return null
  // The post IS live; only the row failed to record it. Falling through to the
  // default here told someone their post "didn't go out" and invited them to
  // publish it again — the precise action the marker exists to prevent, aimed
  // at a post already on their timeline.
  if (isRecordFailure(code)) {
    return fillProvider(
      `This post published, but we couldn't record it. Check ${PROVIDER} before publishing again.`,
      platform
    )
  }
  return fillProvider(
    PUBLISH_FAILURE_TEMPLATES[code as PublishFailure] ??
      "This post didn't go out. Try publishing it again.",
    platform
  )
}

// A `record_failed:<id>` marker rather than an ordinary failure code. The
// provider's id is appended, so this is a prefix test, not an equality one.
export function isRecordFailure(code: string | null): boolean {
  return code !== null && code.startsWith(RECORD_FAILED_PREFIX)
}

// The short form, for a card that has room for two words and not a sentence.
// Deliberately the same label for every code: on a card the distinction that
// matters is "this didn't go out", and the reason belongs on the post's own
// page where there is room to say what to do about it.
export const PUBLISH_FAILED_LABEL = "Didn't send"

// Except for the one code where "didn't send" is the opposite of the truth.
export const PUBLISH_UNRECORDED_LABEL = "Sent, not recorded"

export function publishFailedLabel(code: string | null): string {
  return isRecordFailure(code) ? PUBLISH_UNRECORDED_LABEL : PUBLISH_FAILED_LABEL
}

// What the client should mirror into `posts.publish_error` after a failed
// publish, so the optimistic patch matches the row the server actually wrote.
// A record failure stores the marker *with its provider id*; anything else
// stores the bare code. Getting this wrong is invisible until a reload, when
// the card silently changes what it says.
export function publishErrorFor(result: {
  failure?: string
  publishedUrn?: string
}): string {
  if (result.publishedUrn) {
    return `${RECORD_FAILED_PREFIX}${result.publishedUrn}`
  }
  return result.failure ?? "publish"
}
