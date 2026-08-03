"use client"

import * as React from "react"

interface ScrollFadeOptions {
  // Which way the element scrolls. "x" fades its left/right edges, "y" its
  // top/bottom.
  axis?: "x" | "y"
  // How wide each fade runs at most — start is left/top, end is right/bottom.
  start?: number
  end?: number
}

function buildMask(axis: "x" | "y", startPx: number, endPx: number): string {
  const direction = axis === "x" ? "to right" : "to bottom"
  const startStop = startPx > 0 ? `transparent, black ${startPx}px` : "black 0"
  const endStop =
    endPx > 0 ? `black calc(100% - ${endPx}px), transparent` : "black 100%"
  return `linear-gradient(${direction}, ${startStop}, ${endStop})`
}

// Fades a scrollable element's edges against whatever is still scrollable
// there — a CSS mask, not overflow, so content leaving the box dissolves
// instead of being sliced at a hard line.
//
// Each edge's fade is the *actual remaining scroll distance at that edge*,
// capped at the configured width, not a binary on/off. That's the detail that
// makes it usable at rest: an unscrolled element has nothing behind its start
// edge, so that fade is zero and resting content is never dimmed — no padding
// or negative-margin trick needed to hold the fade off it (which is what the
// static masks elsewhere in this codebase, e.g. GeneratedPostCard's topics
// row, have to do). It also removes the dead zone a binary switch has, where
// the fade still covers content that has almost nothing left to reveal.
//
// Writes the mask straight to the element rather than returning a style: this
// runs on every scroll frame, and routing it through React state would
// re-render the whole subtree each time. Callers must not set `maskImage`
// themselves on the same element.
export function useScrollFade({
  axis = "y",
  start = 24,
  end = 24,
}: ScrollFadeOptions = {}) {
  const elementRef = React.useRef<HTMLElement | null>(null)
  const observerRef = React.useRef<ResizeObserver | null>(null)

  const update = React.useCallback(() => {
    const element = elementRef.current
    if (!element) return
    const scrolled = axis === "x" ? element.scrollLeft : element.scrollTop
    const max =
      axis === "x"
        ? element.scrollWidth - element.clientWidth
        : element.scrollHeight - element.clientHeight
    const startPx = Math.max(0, Math.min(start, scrolled))
    const endPx = Math.max(0, Math.min(end, max - scrolled))
    const mask = buildMask(axis, startPx, endPx)
    element.style.maskImage = mask
    element.style.webkitMaskImage = mask
  }, [axis, start, end])

  // A callback ref, not useRef + useEffect: an element that mounts later (a
  // column appearing when a tab switches) would otherwise have its observer
  // attached to a null ref and never get a second chance — see
  // hooks/use-squircle-clip-path.ts for the same trap.
  const ref = React.useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null
      elementRef.current = node
      if (!node) return
      const observer = new ResizeObserver(update)
      observer.observe(node)
      observerRef.current = observer
      update()
    },
    [update]
  )

  // Deliberately no dependency array: a ResizeObserver only fires when the
  // element's own box changes, and these are fixed-size scrollers — adding or
  // removing content changes what's scrollable without resizing anything.
  // Re-measuring after every render is a couple of DOM reads and keeps up with
  // that; it sets no state, so it can't cascade.
  React.useLayoutEffect(() => {
    update()
  })

  return { ref, onScroll: update }
}
