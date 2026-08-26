"use client"

import * as React from "react"

import {
  getGenerationLock,
  getGenerationLockServerSnapshot,
  subscribeToGenerationLock,
} from "@/lib/generation-lock"

// How the chrome reads while something on the page must not be navigated away
// from. Both pieces (the sidebar card and the navbar) use the identical
// treatment, so it lives here rather than being written twice.
//
// `inert` is what actually prevents the interaction — it blocks pointer
// events, takes the whole subtree out of the tab order, and hides it from
// assistive tech, which `pointer-events-none` alone does none of (a Tab and
// Enter would still navigate away mid-run). The opacity is the part that says
// so out loud. Both fade rather than snap: the lock lands the moment
// generation starts, and a hard cut there reads as a glitch.
export const CHROME_LOCK_CLASSNAME =
  "opacity-40 transition-opacity duration-300 ease-out"
export const CHROME_UNLOCK_CLASSNAME = "transition-opacity duration-300 ease-out"

// Subscribes the caller to the lock. Returns the boolean; each consumer
// decides how to apply it, since one is an <aside> and the other a <header>.
export function useGenerationLock(): boolean {
  return React.useSyncExternalStore(
    subscribeToGenerationLock,
    getGenerationLock,
    getGenerationLockServerSnapshot
  )
}
