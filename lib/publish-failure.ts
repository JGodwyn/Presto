import type { PublishFailure } from "@/lib/linkedin/publish"

// What a publish failure says to the person who has to do something about it.
//
// Kept out of both the action and the components so the server's toast and the
// card's own treatment can never describe the same failure differently — and
// pure, so a client component can read it without dragging the share call into
// the bundle (the type import above is erased at compile time; see the note at
// the top of lib/linkedin/publish.ts).

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
  return (
    PUBLISH_FAILURE_MESSAGES[code as PublishFailure] ??
    "This post didn't go out. Try publishing it again."
  )
}

// The short form, for a card that has room for two words and not a sentence.
// Deliberately the same label for every code: on a card the distinction that
// matters is "this didn't go out", and the reason belongs on the post's own
// page where there is room to say what to do about it.
export const PUBLISH_FAILED_LABEL = "Didn't send"
