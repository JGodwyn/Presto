"use client"

import * as React from "react"

// Where each keyed scroll container was left. A module-level Map rather than
// session/localStorage (which is what lib/content-view.ts uses for the tab and
// layout): those are preferences worth keeping, a scroll offset is only
// meaningful for the trip you're on — leaving for a post's own page and coming
// back. Living in the module means it survives every client navigation and
// dies with a real page load, which is exactly right: a reload should start at
// the top. It also keeps the write cheap enough to do on every scroll frame,
// where a synchronous storage write would not be.
const positions = new Map<string, number>()

// Remembers a scroll container's offset under `key` and puts it back the next
// time an element mounts under that same key.
//
// Restoring from the callback ref rather than an effect is deliberate: React
// attaches refs bottom-up once the subtree's DOM is in place, so the content
// that makes the element scrollable already exists when this runs, and the
// assignment sticks. A changed `key` re-runs it (React detaches the old
// callback and attaches the new one), which is what lets one hook cover
// several tabs' worth of positions.
export function useScrollMemory(key: string) {
  const ref = React.useCallback(
    (node: HTMLElement | null) => {
      if (!node) return
      // Back to the top when this key has no position yet, rather than leaving
      // whatever was there. A key change doesn't always mean a new element:
      // two branches of a ternary that both render a <div> reuse the same DOM
      // node, so switching tabs or layouts otherwise inherits the offset from
      // the list that was there before — a different list, scrolled to a place
      // nobody chose.
      node.scrollTop = positions.get(key) ?? 0
    },
    [key]
  )

  const onScroll = React.useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      positions.set(key, event.currentTarget.scrollTop)
    },
    [key]
  )

  return { ref, onScroll }
}
