import { connectionStatus, isConnectionDead } from "@/lib/format-date"
import type { PostPlatform } from "@/types/post"
import type { ConnectedSocialAccount } from "@/types/social-account"

export function hasDeadLinkedInConnection(
  accounts: ConnectedSocialAccount[],
  now: Date
): boolean {
  return accounts.some(
    (account) =>
      account.platform === "linkedin" &&
      isConnectionDead(
        connectionStatus(
          new Date(account.expiresAt),
          account.status === "revoked",
          now
        )
      )
  )
}

// Generate can offer only accounts that can eventually publish. A stored row
// is not enough: expired and revoked connections stay visible on Connections
// so they can be repaired, but must be disabled in the account picker.
export function healthyConnectedPlatforms(
  accounts: ConnectedSocialAccount[],
  now: Date
): PostPlatform[] {
  return accounts
    .filter(
      (account) =>
        !isConnectionDead(
          connectionStatus(
            new Date(account.expiresAt),
            account.status === "revoked",
            now
          )
        )
    )
    .map((account) => account.platform)
}

// Try-out posts never leave Presto, and an expired LinkedIn connection must
// not block X. This predicate keeps that boundary identical everywhere a
// post can be queued or published.
export function isBlockedByExpiredLinkedIn(
  hasExpiredLinkedIn: boolean,
  platform: PostPlatform,
  isTryout: boolean
): boolean {
  return hasExpiredLinkedIn && platform === "linkedin" && !isTryout
}
