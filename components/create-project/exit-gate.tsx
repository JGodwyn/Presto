"use client"

import * as React from "react"

// Holds the /projects page back until /create-project's exit has finished, so
// the side art's retreat is the last thing on screen before the next page.
//
// The navigation itself starts early, alongside the retreat, so the page's
// server render (session check + a database read; it's dynamic and so never
// prefetched) happens while the art tucks away rather than after it. But a
// navigation commits the moment its data arrives — which could be mid-retreat.
// So /projects renders this gate, and while the exit is still playing the gate
// suspends on it. Navigations run as transitions, and a transition keeps the
// current page on screen while the incoming one is suspended: the swap waits
// for whichever finishes last, the data or the retreat.
//
// Module state rather than context: the dialog that starts the exit and the
// page that waits on it live in different routes with no shared provider.

let pending: Promise<void> | null = null

export function holdNavigationUntil(done: Promise<void>) {
  pending = done
  void done.finally(() => {
    if (pending === done) pending = null
  })
}

export function CreateProjectExitGate() {
  // `use` suspends until the promise settles, then returns straight through.
  // Nothing pending (any arrival other than the create-project exit): no-op.
  const exit = pending
  if (exit) React.use(exit)
  return null
}
