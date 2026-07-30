"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowClockwise, SpinnerGap, WifiSlash } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { probeNetwork } from "@/lib/network-status"

// How often to re-check while a connectivity failure is what broke the page.
// Matches network-status.tsx's own probe cadence.
const RECONNECT_PROBE_INTERVAL = 5000

// The screen behind every error.tsx in the app. Server components here fetch
// directly (fetchProject throws rather than returning null on a failed query),
// so a Supabase outage mid-navigation lands on this boundary rather than
// anywhere the client-side toast could reach — the request that failed was
// made by the *server*, during a render.
//
// The copy deliberately doesn't commit to a cause. It can't: Next redacts
// server-side error messages in production, leaving only a digest, so there's
// no way to tell an outage from a bug here. "You might be offline" covers the
// likely case without claiming it. The probe below is still used, but only to
// drive recovery, not wording.
export function RouteErrorRecovery({ reset }: { reset: () => void }) {
  const router = useRouter()
  const [offline, setOffline] = React.useState(false)
  const [isRetrying, startRetry] = React.useTransition()

  // reset() on its own re-renders the boundary against the same already-failed
  // RSC payload, so the screen just re-appears and the button looks dead.
  // router.refresh() is what actually re-fetches it from the server; reset()
  // then clears the error state so the fresh render can take its place.
  const retry = React.useCallback(() => {
    startRetry(() => {
      router.refresh()
      reset()
    })
  }, [router, reset])

  React.useEffect(() => {
    let cancelled = false
    // probeNetwork also updates the global store, so the offline toast appears
    // over this screen when that's the real story.
    void probeNetwork().then((reachable) => {
      if (!cancelled) setOffline(!reachable)
    })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!offline) return
    const timer = setInterval(() => {
      void probeNetwork().then((reachable) => {
        // Reload the moment the connection is back, rather than leaving
        // someone looking at an error page that's no longer true.
        if (reachable) retry()
      })
    }, RECONNECT_PROBE_INTERVAL)
    return () => clearInterval(timer)
  }, [offline, retry])

  return (
    <EmptyState
      icon={WifiSlash}
      caption="Something's wrong"
      // The export writes "check" lowercase mid-sentence; fixed here. It's
      // invisible in the rendered output anyway (Phudu is all caps) but the
      // source shouldn't carry the typo.
      title="We couldn't load this page. Check your internet connection & try again."
      action={
        <Button variant="brand" size="xl" onClick={retry} disabled={isRetrying}>
          {isRetrying ? (
            <>
              <SpinnerGap weight="bold" className="animate-spin" />
              Trying again
            </>
          ) : (
            <>
              <ArrowClockwise weight="bold" />
              Try again
            </>
          )}
        </Button>
      }
      className="transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]"
    />
  )
}
