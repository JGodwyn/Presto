"use client"

import * as React from "react"

// Matches the segmented control indicator's own move-on-screen timing — the
// "quick move" curve reserved for existing elements repositioning, distinct
// from whatever mount/exit curve the caller's own enter/exit animation uses.
const REORDER_DURATION_MS = 150
const REORDER_EASING = "cubic-bezier(0.77,0,0.175,1)"

// FLIP (First-Last-Invert-Play): when an item leaves a list, the remaining
// ones snap to their new position the instant the DOM updates — reflow
// isn't something CSS can transition on its own. This measures each
// surviving item's position before and after a reflow, then plays a
// translate from the old delta down to zero. Freshly-arriving items are
// skipped (no prior position to invert from); they get their own enter
// animation from the caller instead. 2D (translateX and Y) rather than a
// single axis, since a caller might reflow either way (e.g. a multi-column
// grid reflowing vertically after a delete shifts a later row up, not just
// sideways).
//
// Runs the move via the Web Animations API rather than a CSS `transition`
// written through inline style: an inline `element.style.transition` sets
// the *shorthand* `transition` property, which fully replaces (not merges
// with) whatever transition the item's own class list already declares for
// its enter/exit animation, since inline style always wins over a class for
// the same property — that would silently disable the item's own future
// fade the first time it got reordered. `element.animate()` is entirely
// independent of the CSS `transition` property, so a reorder and a fade on
// the same element can never collide. Cancelling any still-in-flight
// reorder animation on a node before starting a new one also prevents two
// reorders landing close together from fighting over the same transform —
// without that, the next measurement would read a mid-flight position
// instead of the settled one, producing a "moves forward, then back" jitter.
function useFlipReorder(
  keys: string[],
  options?: {
    // Skips measuring/animating entirely when this render only ADDED keys
    // (nothing was removed) — for lists where growth never legitimately
    // displaces existing items (e.g. GeneratingView's posts grid: a new
    // card only ever appends into an empty cell, per how CSS Grid's
    // auto-fill actually lays things out — confirmed nothing shifts on
    // append), but a bug elsewhere could still occasionally read the wrong
    // stale rect for an unrelated reason and fire a spurious near-instant
    // "correction" animation that reads as a brief, unwanted jump. Off by
    // default — the calendar's skip-dates carousel genuinely needs
    // both-direction support, since a newly-selected month can sort
    // anywhere chronologically, not just at the end, and *should* displace
    // later items when it lands in the middle.
    skipOnGrowth?: boolean
  }
) {
  const nodes = React.useRef(new Map<string, HTMLElement>())
  const refCache = React.useRef(
    new Map<string, (node: HTMLElement | null) => void>()
  )
  const prevRects = React.useRef(new Map<string, { left: number; top: number }>())
  const activeAnimations = React.useRef(new Map<string, Animation>())
  const skipOnGrowth = options?.skipOnGrowth ?? false

  const register = React.useCallback((key: string) => {
    let cached = refCache.current.get(key)
    if (!cached) {
      cached = (node) => {
        if (node) nodes.current.set(key, node)
        else nodes.current.delete(key)
      }
      refCache.current.set(key, cached)
    }
    return cached
  }, [])

  React.useLayoutEffect(() => {
    const newRects = new Map<string, { left: number; top: number }>()
    nodes.current.forEach((node, key) => {
      const rect = node.getBoundingClientRect()
      newRects.set(key, { left: rect.left, top: rect.top })
    })

    // Growth-only means every previously-tracked key is still present —
    // nothing left, only (maybe) arrived.
    const isGrowthOnly =
      prevRects.current.size > 0 &&
      newRects.size > prevRects.current.size &&
      [...prevRects.current.keys()].every((key) => newRects.has(key))

    if (!skipOnGrowth || !isGrowthOnly) {
      nodes.current.forEach((node, key) => {
        const oldRect = prevRects.current.get(key)
        const newRect = newRects.get(key)
        if (!oldRect || !newRect) return
        const deltaX = oldRect.left - newRect.left
        const deltaY = oldRect.top - newRect.top
        if (deltaX === 0 && deltaY === 0) return

        activeAnimations.current.get(key)?.cancel()
        const animation = node.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: "none" },
          ],
          { duration: REORDER_DURATION_MS, easing: REORDER_EASING }
        )
        activeAnimations.current.set(key, animation)
        animation.finished
          .catch(() => {})
          .finally(() => {
            if (activeAnimations.current.get(key) === animation) {
              activeAnimations.current.delete(key)
            }
          })
      })
    }

    prevRects.current = newRects
    // Re-run whenever the actual sequence of rendered keys changes (an item
    // joining or leaving) — that's the only time a reflow this hook needs to
    // correct for can happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(",")])

  return { register }
}

export { useFlipReorder }
