"use client"

import * as React from "react"

import { Toast } from "@/components/ui/toast"
import {
  getNetworkOffline,
  getNetworkOfflineServerSnapshot,
  probeNetwork,
  reportNetworkIssue,
  reportNetworkReachable,
  subscribeToNetworkStatus,
} from "@/lib/network-status"

// How often to re-check while disconnected. Long enough not to hammer, short
// enough that the toast clears on its own shortly after the connection comes
// back rather than waiting for the user's next action.
const RECONNECT_PROBE_INTERVAL = 5000

// Mounted once in the root layout so every screen is covered — signed out or
// in, mid-generation or idle. It only renders; the reporting is done by the
// browser's own online/offline events below and by each call site through
// withNetworkStatus (lib/network-status.ts).
export function NetworkStatus() {
  const offline = React.useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkOffline,
    getNetworkOfflineServerSnapshot
  )

  React.useEffect(() => {
    // navigator.onLine is only trustworthy in the negative: false definitely
    // means disconnected, true only means an interface is up. So it's used to
    // raise the flag, never to clear it — clearing is left to a real request
    // succeeding.
    if (!navigator.onLine) reportNetworkIssue()

    const handleOffline = () => reportNetworkIssue()
    const handleOnline = () => {
      void probeNetwork()
    }

    window.addEventListener("offline", handleOffline)
    window.addEventListener("online", handleOnline)
    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online", handleOnline)
    }
  }, [])

  React.useEffect(() => {
    if (!offline) return
    const timer = setInterval(() => {
      void probeNetwork()
    }, RECONNECT_PROBE_INTERVAL)
    return () => clearInterval(timer)
  }, [offline])

  return (
    // Same fixed top-center slot every other toast in the app uses, at a
    // higher z-index than the rest: connectivity outranks whatever else is
    // being reported, since it explains those failures.
    <div className="pointer-events-none fixed inset-x-0 top-pad-2xl z-100 flex justify-center">
      <Toast
        open={offline}
        // The toast reports an ongoing condition, so it has no auto-dismiss:
        // it's owned entirely by the store and clears when a request succeeds.
        // onOpenChange still has to do something real — Toast calls it on
        // nothing else, but treating a close as "assume we're back" would lie.
        onOpenChange={(next) => {
          if (!next) reportNetworkReachable()
        }}
        duration={null}
        variant="danger"
        extraInfo="Check your connection"
      >
        You might be offline
      </Toast>
    </div>
  )
}
