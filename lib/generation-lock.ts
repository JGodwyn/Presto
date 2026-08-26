"use client"

// Whether the app's chrome — the project sidebar and the navbar — is locked,
// i.e. whether something is running on the page that leaving it would destroy.
//
// Today that is exactly one thing: a generation in flight. Navigating away
// unmounts the generating view, and unmounting *is* how a run stops (see
// generating-view.tsx's own note on Close), so a stray tab click silently
// throws away whatever was left to generate. The page already has Stop, and a
// Close that only appears once the run has stopped or finished; the chrome
// sitting fully live beside them was the one way out that never said what it
// would cost.
//
// A module-level store rather than context, for the same reason
// lib/section-navigation.ts and lib/network-status.ts are: the writer is a
// deep page component and the readers are two pieces of layout chrome *above*
// it in the tree, so a provider would have to be threaded through the layout
// to connect them.

let locked = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeToGenerationLock(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getGenerationLock() {
  return locked
}

// useSyncExternalStore needs a server snapshot that never changes. A server
// render can't know about a run that exists only in this browser tab, and the
// lock is only ever set from a client effect, so it starts unlocked.
export function getGenerationLockServerSnapshot() {
  return false
}

export function setGenerationLock(value: boolean) {
  if (locked === value) return
  locked = value
  emit()
}
