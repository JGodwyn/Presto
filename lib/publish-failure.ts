import type { PublishFailure } from "@/lib/linkedin/publish"

// What a publish failure says to the person who has to do something about it.
//
// Kept out of both the action and the components so the server's toast and the
// card's own treatment can never describe the same failure differently — and
// pure, so a client component can read it without dragging the share call into
// the bundle (the type import above is erased at compile time; see the note at
// the top of lib/linkedin/publish.ts).

// Marks a post that IS live at the provider but whose row could not be updated
// to say so. The URN is appended, so every test on it is a prefix test.
//
// **Defined here, in the pure module, and imported by the runner — not the
// reverse.** This file is read by client components (the card's status marker,
// the deck, post details); `lib/publish-runner` reaches Supabase and the share
// call and is on no-client-sdk.test.ts's server-only list. Importing the runner
// from here to borrow one string would have pulled all of that into the browser
// bundle, which is the exact trap lib/ai/model-constants.ts exists to avoid.
export const RECORD_FAILED_PREFIX = "record_failed:"

export const PUBLISH_FAILURE_MESSAGES: Record<PublishFailure, string> = {
  publishing_disabled:
    "Publishing to a live account is switched off for this app.",
  scope_not_granted:
    "This connection doesn't have permission to post. Reconnect the account and try again.",
  token_expired: "That connection has expired. Reconnect it and try again.",
  not_connected: "There's no connected account to publish this to.",
  network: "Couldn't reach LinkedIn. Check your connection and try again.",
  publish: "LinkedIn wouldn't accept this post. Try again.",
}

// `posts.publish_error` is a text column with no constraint, written from this
// union — but a row could carry a code from an older build, or one that has
// since been renamed. So a lookup miss is a real possibility rather than a
// theoretical one, and it degrades to something true rather than "undefined".
export function publishFailureMessage(code: string | null): string | null {
  if (code === null) return null
  // The post IS live; only the row failed to record it. Falling through to the
  // default here told someone their post "didn't go out" and invited them to
  // publish it again — the precise action the marker exists to prevent, aimed
  // at a post already on their timeline.
  if (isRecordFailure(code)) {
    return "This post published, but we couldn't record it. Check LinkedIn before publishing again."
  }
  return (
    PUBLISH_FAILURE_MESSAGES[code as PublishFailure] ??
    "This post didn't go out. Try publishing it again."
  )
}

// A `record_failed:<urn>` marker rather than an ordinary failure code. The URN
// is appended, so this is a prefix test, not an equality one.
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
// A record failure stores the marker *with its URN*; anything else stores the
// bare code. Getting this wrong is invisible until a reload, when the card
// silently changes what it says.
export function publishErrorFor(result: {
  failure?: string
  publishedUrn?: string
}): string {
  if (result.publishedUrn) {
    return `${RECORD_FAILED_PREFIX}${result.publishedUrn}`
  }
  return result.failure ?? "publish"
}
