import type { SocialAccountStatus } from "@/types/social-account"

// How long a completed liveness check is trusted for. A revocation is rare and
// not urgent — noticing it an hour late costs nothing, while asking LinkedIn on
// every visit to the Connections page costs a request per navigation.
//
// Shared by both ends on purpose: the Connections page uses it to avoid making
// a pointless round trip, and checkSocialAccountLiveness uses it again as the
// authority. A client with a stale idea of the interval therefore can't cause
// an extra call to LinkedIn — the worst it can do is ask our own server a
// question it answers "skipped" from the database.
export const LIVENESS_CHECK_INTERVAL_MS = 60 * 60 * 1000

// Whether a connection is worth asking LinkedIn about right now.
//
// A row already marked revoked is never due: only reconnecting clears that,
// and the OAuth callback resets the column when it does. A row that has never
// been checked (null) always is.
export function isLivenessCheckDue(
  account: { status: SocialAccountStatus; lastCheckedAt: string | null },
  now: Date
): boolean {
  if (account.status === "revoked") return false
  if (!account.lastCheckedAt) return true

  const lastChecked = new Date(account.lastCheckedAt).getTime()
  // An unparseable timestamp reads as "never checked" rather than "checked at
  // the epoch", which happens to be the same answer — but says why.
  if (Number.isNaN(lastChecked)) return true

  return now.getTime() - lastChecked >= LIVENESS_CHECK_INTERVAL_MS
}
