"use client"

import * as React from "react"

// Coalesces a burst of "save the full current state" calls into a strictly
// ordered stream of requests: at most one save is ever in flight, and any
// calls that arrive while one is running are collapsed down to just the
// latest payload — older ones in the burst are dropped, not queued, because
// each payload is already a complete snapshot of the current state (a full
// upsert), so only the most recent one needs to reach the server. This is
// what stops rapid-fire calls (e.g. adding several topics quickly) from
// resolving out of order and leaving stale data persisted — since there's
// never more than one request outstanding, there's nothing left to reorder.
// No debounce delay: the first save in an idle period still fires
// immediately.
//
// `save` must be a stable reference (wrap it in `useCallback`) — this hook
// doesn't resync to a changing `save` across renders, only the queued
// payloads change.
function useSaveQueue<T>(save: (payload: T) => Promise<void>) {
  const savingRef = React.useRef(false)
  const pendingRef = React.useRef<{ payload: T } | null>(null)

  // Iterative, not recursive: a self-recursive useCallback would reference
  // its own (memoized) binding from inside itself, which the react-hooks
  // lint rule flags as not safely tracking updates. A loop drains whatever
  // keeps landing in `pendingRef` while this save is in flight instead.
  const drain = React.useCallback(
    async (payload: T) => {
      savingRef.current = true
      let current = payload
      for (;;) {
        try {
          await save(current)
        } catch (error) {
          // `save` is expected to report failures it anticipates itself
          // (e.g. via a toast); this only guards against it throwing
          // outright, so one failed save can't wedge the queue and
          // silently drop whatever was waiting behind it.
          console.error("useSaveQueue: save failed", error)
        }
        if (pendingRef.current === null) break
        current = pendingRef.current.payload
        pendingRef.current = null
      }
      savingRef.current = false
    },
    [save]
  )

  const queueSave = React.useCallback(
    (payload: T) => {
      if (savingRef.current) {
        pendingRef.current = { payload }
        return
      }
      void drain(payload)
    },
    [drain]
  )

  return queueSave
}

export { useSaveQueue }
