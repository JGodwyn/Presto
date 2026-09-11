"use client"

import * as React from "react"

import { useOnboarding } from "@/components/onboarding/onboarding-context"
import { cn } from "@/lib/utils"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"

// The top keeps the existing 24px treatment. Mobile's bottom edge uses a
// slightly longer 32px dissolve because it terminates against a persistent
// tab bar rather than the viewport edge.
const TOP_FADE_PX = 24
const BOTTOM_FADE_PX = 32

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
// Desktop deliberately has no bottom fade: `<main>` bleeds through the page's
// bottom padding to the real screen edge. Mobile is different — the exported
// content viewport ends above a persistent tab bar, so it gets a matching
// bottom strip to dissolve the cards before that hard edge.
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
  const { step } = useOnboarding()
  // The tour narrates the current page behind its blur. Keep that page visible
  // but remove it from both hit testing and the tab order; the callout is a
  // sibling below, so its Next/Complete action remains the only controller.
  const onboardingLocked = typeof step === "number"
  const topFadeRef = React.useRef<HTMLDivElement | null>(null)
  const bottomFadeRef = React.useRef<HTMLDivElement | null>(null)
  const scrollAreaRef = React.useRef<HTMLElement | null>(null)
  const contentObserverRef = React.useRef<MutationObserver | null>(null)

  // Writes opacity straight to the strip rather than going through state:
  // this runs on every scroll frame, and a setState here would re-render the
  // whole section subtree each time. Same reasoning as hooks/use-scroll-fade.
  const applyFade = React.useCallback((element: HTMLElement) => {
    const topStrip = topFadeRef.current
    const bottomStrip = bottomFadeRef.current
    if (!topStrip || !bottomStrip) return
    // Ramps in over the first 24px of scroll, so the strip is fully absent at
    // rest and never dims content that has nothing hidden above it.
    topStrip.style.opacity = String(
      Math.min(1, element.scrollTop / TOP_FADE_PX)
    )
    const remaining = Math.max(
      0,
      element.scrollHeight - element.clientHeight - element.scrollTop
    )
    bottomStrip.style.opacity = String(
      Math.min(1, remaining / BOTTOM_FADE_PX)
    )
  }, [])

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLElement>) => applyFade(event.currentTarget),
    [applyFade]
  )

  // Disclosure panels grow through CSS grid transitions. That changes the
  // main element's scrollHeight without inserting a node or resizing the
  // main element itself, so neither the observer nor a ResizeObserver on main
  // would notice. Transition events bubble: remeasure at the settled size so
  // the mobile bottom fade appears without requiring a first scroll gesture.
  const handleTransitionEnd = React.useCallback(
    (event: React.TransitionEvent<HTMLElement>) =>
      applyFade(event.currentTarget),
    [applyFade]
  )

  // A callback ref, not an effect: it fires on the actual attach, so a section
  // restored mid-scroll (the Content page remembers its offset) shows the
  // right strip on arrival instead of only after the first wheel event.
  const mainRef = React.useCallback(
    (node: HTMLElement | null) => {
      contentObserverRef.current?.disconnect()
      contentObserverRef.current = null
      scrollAreaRef.current = node
      if (!node) return

      // The project layout (and therefore this scroll container) survives a
      // section navigation. New server-rendered page content can arrive later
      // without resizing <main>, so neither this callback nor its scroll
      // handler would run again. Observe that insertion and measure the new
      // scroll height immediately; otherwise the bottom fade waits for the
      // first user scroll to appear.
      const contentObserver = new MutationObserver(() => applyFade(node))
      contentObserver.observe(node, {
        childList: true,
        subtree: true,
        // Covers reduced-motion mode, where the disclosure class changes but
        // there is no transitionend event to provide the final measurement.
        attributes: true,
        attributeFilter: ["class", "hidden", "aria-expanded"],
      })
      contentObserverRef.current = contentObserver
      applyFade(node)
    },
    [applyFade]
  )

  // The fade strips mount after <main>. Re-run the initial measurement as
  // each one attaches; otherwise the first mainRef pass sees null strips and
  // the bottom fade stays absent until the user scrolls once.
  const topStripRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      topFadeRef.current = node
      if (node && scrollAreaRef.current) applyFade(scrollAreaRef.current)
    },
    [applyFade]
  )
  const bottomStripRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      bottomFadeRef.current = node
      if (node && scrollAreaRef.current) applyFade(scrollAreaRef.current)
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
    <div className="@container/section relative flex min-h-0 min-w-0 flex-1 flex-col md:-mb-pad-4xl">
      {/* No visible scrollbar here by design (native one hidden, no custom
          thumb either) — a thumb positioned against this container's full
          width ended up sitting on top of the References column at some
          widths instead of staying in the page's outer gutter. Scrolling
          itself still works fine via wheel/trackpad/keyboard. */}
      <main
        ref={mainRef}
        onScroll={handleScroll}
        onTransitionEnd={handleTransitionEnd}
        inert={onboardingLocked}
        className={cn(
          // The small mobile tail keeps the final card's rounded border clear
          // of the overflow boundary once the bottom fade has fully retired.
          "flex min-h-0 flex-1 flex-col overflow-y-auto pb-dist-md md:pb-pad-4xl",
          HIDE_NATIVE_SCROLLBAR_CLASSNAME
        )}
      >
        {children}
      </main>

      {/* Sibling of <main>, not a child: inside it, it would scroll away with
          the content. Painted in the page canvas's own colour, so content
          dissolves into the background rather than under a tinted band. */}
      <div
        ref={topStripRef}
        aria-hidden
        style={{ opacity: 0 }}
        className="pointer-events-none absolute inset-x-0 top-0 h-[var(--dist-xl)] bg-linear-to-b from-surface-3 to-transparent"
      />

      <div
        ref={bottomStripRef}
        aria-hidden
        style={{ opacity: 0 }}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[var(--dist-2xl)] bg-[linear-gradient(to_top,var(--surface-3)_0,var(--surface-3)_var(--dist-md),transparent_100%)] md:hidden"
      />

      {overlay}
    </div>
  )
}
