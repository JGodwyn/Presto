// One definition of "we couldn't reach the server" for both sides of the app:
// server actions and middleware classifying a failed Supabase call, and the
// browser classifying a failed fetch. It deliberately does not live in
// lib/supabase/ — the same shapes come back from any fetch, Supabase or not.
//
// The distinction matters because a network failure and a rejection look
// identical at most call sites, and guessing wrong is user-visible: Supabase
// returns an error from signInWithPassword whether the password was wrong or
// the request never arrived, and auth.getUser() yields "no user" whether the
// session expired or the auth server was unreachable. Both were being read as
// the pessimistic case — "incorrect password", "you've been signed out".

// Node's undici and the browser word the same failure differently, and
// Supabase wraps its own retryable fetch failures in a named error class
// rather than exposing the cause.
const NETWORK_ERROR_MESSAGE_PATTERN =
  /fetch failed|failed to fetch|networkerror|network request failed|load failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|ENETDOWN/i

// Supabase sets status 0 on an error that never got an HTTP response at all.
function hasZeroStatus(error: object): boolean {
  return "status" in error && (error as { status?: unknown }).status === 0
}

export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  // An aborted request is a deliberate cancellation, not a connectivity
  // problem — it also surfaces as a rejected fetch, so it has to be excluded
  // before any of the checks below.
  if (error instanceof Error && error.name === "AbortError") return false
  if (error instanceof DOMException && error.name === "AbortError") return false

  // Supabase's own class for "the request failed and is worth retrying",
  // which is what signInWithPassword/getUser reject with when offline.
  if (error instanceof Error && error.name === "AuthRetryableFetchError") {
    return true
  }

  if (hasZeroStatus(error)) return true

  if (error instanceof Error) {
    if (NETWORK_ERROR_MESSAGE_PATTERN.test(error.message)) return true
    // undici hides the real reason (ENOTFOUND and friends) one level down,
    // under a generic "fetch failed" on the outer error.
    if (error.cause) return isNetworkError(error.cause)
  }

  // Plain objects too: Supabase's PostgrestError isn't an Error instance.
  if ("message" in error) {
    const { message } = error as { message?: unknown }
    if (typeof message === "string" && NETWORK_ERROR_MESSAGE_PATTERN.test(message)) {
      return true
    }
  }

  return false
}

// The one wording used everywhere a network failure needs a sentence rather
// than the toast (inline form errors, generation failure copy).
export const NETWORK_ERROR_MESSAGE =
  "We couldn't reach the server. Check your connection and try again."

// What a server action returns when it fails. `network: true` is the part
// clients act on: it tells them to raise the global disconnected toast
// instead of (or as well as) showing the message inline against a field,
// since a connectivity problem isn't the fault of anything the user typed.
export type ActionError = { error: string; network?: true }

export function networkActionError(): ActionError {
  return { error: NETWORK_ERROR_MESSAGE, network: true }
}
