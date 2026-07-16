"use client"

import * as React from "react"

import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"

// Minimum thumb height so a very long scroll area doesn't shrink it to an
// unclickable/invisible sliver.
const MIN_THUMB_HEIGHT = 24
// Keeps the thumb's track inset from the top/bottom of the scroll box —
// without it the thumb reaches flush edge-to-edge at the scroll extremes,
// which looks flush against a curved (squircle) corner and leaves no
// breathing room. Matches pad-sm (8px).
const THUMB_TRACK_PADDING = 8
// How long the thumb stays visible after the last scroll event, matching the
// native overlay-scrollbar behavior this is standing in for (visible while
// scrolling, then fades away) — not a permanently-on indicator.
const HIDE_DELAY_MS = 1000

// Every scrollable area in the app uses this instead of the browser's own
// scrollbar: `::-webkit-scrollbar` customization (width/color/an inset gap
// via border+background-clip) is silently ignored under macOS's overlay-
// scrollbar rendering path, so nothing about the native bar was ever
// actually under our control. This tracks scroll position on the element
// instead and drives a real, code-owned thumb element — originally worked
// out in components/ui/menu.tsx, extracted here so every other scrollable
// container (page scroll, textareas, …) gets the same look.
//
// Pair the returned `ref`/`onScroll` with `HIDE_NATIVE_SCROLLBAR_CLASSNAME`
// on the scrollable element itself, and render a thumb div (absolutely
// positioned in a `relative` ancestor that is *not* the scrolling element
// itself — see menu.tsx's layering note for why) sized/positioned from the
// returned `thumb` value and faded via `visible` — see ScrollbarThumb
// (components/ui/scrollbar-thumb.tsx), which already wires both up.
function useScrollThumb<T extends HTMLElement>(
  deps: React.DependencyList = []
) {
  const elRef = React.useRef<T | null>(null)
  const observerRef = React.useRef<ResizeObserver | null>(null)
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const [thumb, setThumb] = React.useState<{
    top: number
    height: number
  } | null>(null)
  const [visible, setVisible] = React.useState(false)

  // Geometry only — doesn't touch visibility. Used for the initial measure
  // and resize/content-change re-measures, none of which should make an
  // idle thumb pop into view.
  const measure = React.useCallback(() => {
    const el = elRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight <= clientHeight) {
      setThumb(null)
      return
    }
    const trackHeight = clientHeight - THUMB_TRACK_PADDING * 2
    const height = Math.max(
      (clientHeight / scrollHeight) * trackHeight,
      MIN_THUMB_HEIGHT
    )
    const top =
      THUMB_TRACK_PADDING +
      (trackHeight - height) * (scrollTop / (scrollHeight - clientHeight))
    setThumb({ top, height })
  }, [])

  // The actual scroll handler: re-measures and reveals the thumb for
  // HIDE_DELAY_MS, restarting the timer on every subsequent scroll event.
  const handleScroll = React.useCallback(() => {
    measure()
    setVisible(true)
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS)
  }, [measure])

  // A callback ref rather than useRef+useEffect — see
  // use-squircle-clip-path.ts's note on why: elements that mount
  // conditionally need a chance to attach the observer after the fact.
  const ref = React.useCallback(
    (element: T | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null
      elRef.current = element
      if (!element) return

      measure()
      const observer = new ResizeObserver(measure)
      observer.observe(element)
      observerRef.current = observer
    },
    [measure]
  )

  // Re-measures when the caller's own deps change (e.g. content that can
  // change the scrollable height without the box's own rendered size
  // changing, since it's pinned to a fixed/max height) — ResizeObserver
  // alone wouldn't catch that.
  React.useEffect(() => {
    measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps])

  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  return { ref, thumb, visible, onScroll: handleScroll }
}

// Re-exported for existing call sites (menu.tsx, pill-textarea.tsx) — the
// canonical definition lives in lib/scrollbar.ts, a plain module a Server
// Component can also import from (see that file for why this one can't
// define it directly).
export { useScrollThumb, HIDE_NATIVE_SCROLLBAR_CLASSNAME }
