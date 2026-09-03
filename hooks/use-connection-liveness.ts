"use client"

import * as React from "react"

import { checkSocialAccountLiveness } from "@/app/projects/[projectId]/connections/actions"
import { isLivenessCheckDue } from "@/lib/linkedin/liveness"
import { withNetworkStatus } from "@/lib/network-status"
import type { ConnectedSocialAccount } from "@/types/social-account"

// Asks each provider, in the background, whether a connection is still alive.
//
// **Why this exists at all:** a member can revoke Presto's access from the
// provider's own settings, and nothing tells us. The row keeps reading green
// until its expiry runs out, so the first symptom would be a rejection from
// whatever finally used the token. The only way to find out is to use it.
//
// How that is done differs per platform and is decided server-side by
// checkSocialAccountLiveness — LinkedIn spends a request, X gets the answer
// free from the token refresh it needs anyway. This hook is deliberately
// platform-blind: an earlier version filtered X out here, which pushed a
// server-side policy into the client and left X connections never checked at
// all once they had a real answer to give.
//
// Runs *after* mount and never blocks a render: the page paints from the
// database as it always did, and a row only changes if the answer comes back
// revoked. Checks are sequential rather than in parallel — there is at most a
// couple of accounts, and a burst of identical calls to LinkedIn is exactly
// what the throttle exists to prevent.
export function useConnectionLivenessCheck({
  accounts,
  projectId,
  onRevoked,
}: {
  accounts: ConnectedSocialAccount[]
  projectId: string
  onRevoked: (accountId: string) => void
}) {
  // Which accounts this mount has already asked about. Without it the effect
  // would re-run every time `accounts` changes identity — including on the
  // state update this hook itself causes when a connection comes back revoked.
  const askedRef = React.useRef<Set<string>>(new Set())

  React.useEffect(() => {
    const now = new Date()
    const due = accounts.filter(
      (account) =>
        !askedRef.current.has(account.id) && isLivenessCheckDue(account, now)
    )
    if (due.length === 0) return

    for (const account of due) askedRef.current.add(account.id)

    let cancelled = false

    void (async () => {
      for (const account of due) {
        const result = await withNetworkStatus(
          checkSocialAccountLiveness({ projectId, id: account.id })
        )

        // Leaving the page mid-check: the row is already gone from the screen,
        // and the server has recorded whatever it found regardless.
        if (cancelled) return

        // `null` is a request that never landed — withNetworkStatus has
        // already raised the offline toast. An `error` is reported by the
        // action itself. Neither is a verdict on the connection, so neither
        // touches the row: this must only ever act on a definite "revoked".
        if (result === null || "error" in result) continue

        if (result.result === "revoked") onRevoked(account.id)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [accounts, projectId, onRevoked])
}
