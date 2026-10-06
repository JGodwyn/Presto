import { decryptApiKey } from "@/lib/ai/key-crypto"
import { getLinkedInCredentials, revokeLinkedInToken } from "@/lib/linkedin/oauth"
import { getXCredentials, revokeXToken } from "@/lib/x/oauth"

// The columns a revocation needs, as `social_accounts` stores them. Only ever
// selected on the server — these are the one copy of the user's tokens.
export interface RevocableSocialAccount {
  platform: string
  encrypted_access_token: string | null
  encrypted_refresh_token: string | null
}

export const REVOCABLE_SOCIAL_ACCOUNT_COLUMNS =
  "platform, encrypted_access_token, encrypted_refresh_token"

// Tell the provider a connection is over. Best-effort by design: callers have
// already deleted the row (that's what the user asked for), and a token this
// app has thrown away is harmless either way — so nothing here throws.
//
// Shared by Disconnect and Delete project, which both end a connection and
// must end it the same way.
export async function revokeSocialAccount(
  account: RevocableSocialAccount
): Promise<void> {
  try {
    if (account.platform === "x") {
      const credentials = getXCredentials()
      // The refresh token is the connection — revoking it ends access, while
      // the access token beside it lapses within two hours regardless. A row
      // with none left (already revoked, or never granted offline.access) has
      // nothing to revoke.
      if (credentials && account.encrypted_refresh_token) {
        await revokeXToken(
          credentials,
          decryptApiKey(account.encrypted_refresh_token)
        )
      }
    } else if (account.encrypted_access_token) {
      const credentials = getLinkedInCredentials()
      if (credentials) {
        await revokeLinkedInToken(
          credentials,
          decryptApiKey(account.encrypted_access_token)
        )
      }
    }
  } catch {
    // A token stored under a rotated or wrong encryption key throws at decrypt
    // (GCM fails loudly by design), and a provider outage throws at the call.
    // Either way the unrevoked token expires on its own.
  }
}
