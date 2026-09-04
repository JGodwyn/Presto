// A coarse shared clock, for the few things that genuinely change as time
// passes rather than when data does.
//
// **Why a store and not `Date.now()` in a component.** Reading the clock during
// render is impure (react-hooks/purity) and, worse, gives the server render and
// its hydration two different answers — which is exactly why the Content page
// stopped stamping a `now` and threading it down (see its comment in
// calendar/page.tsx). The server snapshot here is `0`, so anything asking "is
// this moment past?" answers no on the server and the marker simply isn't
// rendered until the client takes over. Same module-store-plus-
// useSyncExternalStore shape as lib/network-status.ts and
// lib/section-navigation.ts.
//
// One minute, because the only consumer marks a post overdue: nothing here is
// counting seconds, and a timer that fires 60 times less often is 60 times less
// work for a page that may be showing hundreds of cards. The interval only runs
// while something is subscribed.

const TICK_MS = 60_000

let now = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

export function subscribeToClock(listener: () => void): () => void {
  listeners.add(listener)

  // Refreshed on subscribe, not only on the interval. `now` was last written
  // by a tick, and the interval is torn down when the final subscriber leaves
  // — so after a spell on another page (or another tab, where timers are
  // throttled) the first render back reads a `now` frozen at however long ago
  // that was, and holds it for up to a further minute. Nothing overdue in the
  // interim would be marked. Cheap, and it makes the first paint the accurate
  // one rather than the stalest.
  now = Date.now()

  if (timer === null) {
    timer = setInterval(() => {
      now = Date.now()
      for (const notify of listeners) notify()
    }, TICK_MS)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}

// Cached, not `Date.now()` — useSyncExternalStore compares snapshots by
// identity and re-renders whenever one differs, so a getSnapshot that returned
// a fresh timestamp every call would never stop.
export function getClock(): number {
  return now
}

// Deliberately a constant, and deliberately in the past: a server render must
// not depend on when it happened to run.
export function getServerClock(): number {
  return 0
}
