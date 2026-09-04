"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"

// How tall the top fade runs, and the scroll distance it reaches full strength
// over — 24px, the same edge-fade width the Content page uses.
const TOP_FADE_PX = 24

// `<main>` — the in-project scroll container for every section — plus the fade
// that softens content disappearing under its top edge.
//
// **It is an overlay strip, not a CSS mask, and that distinction is
// load-bearing.** `useScrollFade` would be the obvious tool (it's what every
// other scroller here uses) but it cannot be used on this element: five
// sections render their Toast into a `position: fixed` slot *inside* `<main>`
// (Instructions, Connections, Settings, Content, Generate), and a mask paints
// its entire subtree through the mask's own geometry. A fixed toast sits at
// viewport top-32px while `<main>` starts ~136px down, so it falls outside the
// mask box and is erased completely — verified in-browser with a probe: the
// toast vanishes the instant the mask is applied. Masking is safe on the
// scrollers that have no fixed descendants; this one does.
//
// (Two related mechanics, both checked rather than assumed: `mask` and
// `clip-path` do *not* make an element the containing block for fixed
// descendants — only `filter` does, of the three — so the toasts keep their
// viewport positioning either way. Being painted out is the whole problem.)
//
// There is deliberately **no bottom fade**: `<main>`'s `-mb`/`pb` pair makes
// its scroll area bleed through the page's bottom padding to the real screen
// edge, so content there runs off the display rather than clipping at a line.
// Nothing to soften.
export function SectionScrollArea({
  children,
  overlay,
}: {
  children: React.ReactNode
  // Rendered as a sibling of <main>, on top of both the page and the fade —
  // the onboarding tour's blur/callout. It has to sit out here rather than
  // inside <main> because `overflow-y: auto` forces `overflow-x` to `auto`
  // too, which clips anything an overlay bleeds past the section's own box.
  overlay?: React.ReactNode
}) {
  const fadeRef = React.useRef<HTMLDivElement | null>(null)

  // Writes opacity straight to the strip rather than going through state:
  // this runs on every scroll frame, and a setState here would re-render the
  // whole section subtree each time. Same reasoning as hooks/use-scroll-fade.
  const applyFade = React.useCallback((element: HTMLElement) => {
    const strip = fadeRef.current
    if (!strip) return
    // Ramps in over the first 24px of scroll, so the strip is fully absent at
    // rest and never dims content that has nothing hidden above it.
    strip.style.opacity = String(Math.min(1, element.scrollTop / TOP_FADE_PX))
  }, [])

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLElement>) => applyFade(event.currentTarget),
    [applyFade]
  )

  // A callback ref, not an effect: it fires on the actual attach, so a section
  // restored mid-scroll (the Content page remembers its offset) shows the
  // right strip on arrival instead of only after the first wheel event.
  const mainRef = React.useCallback(
    (node: HTMLElement | null) => {
      if (node) applyFade(node)
    },
    [applyFade]
  )

  return (
    // The wrapper carries the -mb bleed that used to sit on <main> itself, so
    // the scroll area still runs past the page's bottom padding; <main> keeps
    // its own pb to restore breathing room at the end of the scroll.
    //
    // `min-w-0` is not optional here. As a flex child of the sidebar row this
    // div's automatic minimum size is its content, so a wide page (the
    // dashboard's card rows) pushed it straight past the row and off the
    // screen edge. `<main>` never needed it while it was the direct flex
    // child, because `overflow-y-auto` zeroes that automatic minimum as a side
    // effect — this wrapper scrolls nothing, so it has to say it outright.
    // Same trap as GlowPanel's `min-h-0` (INTERFACE.md §4), one axis over.
    <div className="relative -mb-pad-4xl flex min-h-0 min-w-0 flex-1 flex-col">
      {/* No visible scrollbar here by design (native one hidden, no custom
          thumb either) — a thumb positioned against this container's full
          width ended up sitting on top of the References column at some
          widths instead of staying in the page's outer gutter. Scrolling
          itself still works fine via wheel/trackpad/keyboard. */}
      <main
        ref={mainRef}
        onScroll={handleScroll}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto pb-pad-4xl",
          HIDE_NATIVE_SCROLLBAR_CLASSNAME
        )}
      >
        {children}
      </main>

      {/* Sibling of <main>, not a child: inside it, it would scroll away with
          the content. Painted in the page canvas's own colour, so content
          dissolves into the background rather than under a tinted band. */}
      <div
        ref={fadeRef}
        aria-hidden
        style={{ opacity: 0 }}
        className="pointer-events-none absolute inset-x-0 top-0 h-[var(--dist-xl)] bg-linear-to-b from-surface-3 to-transparent"
      />

      {overlay}
    </div>
  )
}
