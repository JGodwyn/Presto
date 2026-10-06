"use client"

import * as React from "react"

import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"

const LANDING_SCROLL_POSITION_KEY = "presto:landing-scroll-position"

// The landing page scrolls inside this element rather than the document, so a
// phone's browser toolbar never collapses mid-page and resizes the full-screen
// sections underneath their snap points. Scrolling and snapping are native
// (`snap-y snap-mandatory` here, a snap point on each narrative section).
function LandingScrollArea({ children }: { children: React.ReactNode }) {
  const scrollAreaRef = React.useRef<HTMLElement | null>(null)
  const hasRestoredRef = React.useRef(false)
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const savePosition = React.useCallback(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return
    sessionStorage.setItem(LANDING_SCROLL_POSITION_KEY, String(scrollArea.scrollTop))
  }, [])

  const ref = React.useCallback((node: HTMLElement | null) => {
    scrollAreaRef.current = node
    if (!node || hasRestoredRef.current) return
    hasRestoredRef.current = true

    // Browsers only restore the document's own scroll position, so a reload
    // would otherwise always land back on the hero.
    const savedPosition = Number(sessionStorage.getItem(LANDING_SCROLL_POSITION_KEY))
    sessionStorage.removeItem(LANDING_SCROLL_POSITION_KEY)
    if (Number.isFinite(savedPosition) && savedPosition > 0) {
      const restore = () => {
        node.scrollTop = savedPosition
      }
      // Hydration and hash handling can settle just after refs attach.
      // Re-apply on the following two frames so neither can reset it to zero.
      requestAnimationFrame(() => {
        restore()
        requestAnimationFrame(restore)
      })
    }

    // Arrow keys, Page Up/Down and Space scroll whichever scroller holds
    // focus. With focus on <body> they'd scroll the document, which never
    // moves here, so the page would look stuck to keyboard users.
    node.focus({ preventScroll: true })
  }, [])

  const onScroll = React.useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(savePosition, 100)
  }, [savePosition])

  // Snapping only belongs to the narrative at the top (hero, problems,
  // Who's-it-for). From the first [data-landing-free-scroll] section down the
  // page scrolls freely, so snapping is switched off there, not just given a
  // tall snap area to roam in: mobile browsers re-snap a tall area to its top
  // when you push past the end of the page. Switched back on as soon as the
  // page is above that point, which is also what snaps a scroll back up into
  // Who's-it-for. Sections that are only free at some sizes opt out with
  // snap-align none (the check below skips them).
  React.useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    const update = () => {
      const top = scrollArea.getBoundingClientRect().top
      const starts = Array.from(
        scrollArea.querySelectorAll<HTMLElement>("[data-landing-free-scroll]")
      )
        .filter((element) => getComputedStyle(element).scrollSnapAlign !== "none")
        .map((element) => scrollArea.scrollTop + element.getBoundingClientRect().top - top)
      if (starts.length === 0) return
      const free = scrollArea.scrollTop >= Math.min(...starts) - 1
      const snapType = free ? "none" : ""
      if (scrollArea.style.scrollSnapType !== snapType) {
        scrollArea.style.scrollSnapType = snapType
      }
    }

    update()
    scrollArea.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      scrollArea.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  React.useEffect(() => {
    window.addEventListener("beforeunload", savePosition)
    return () => {
      window.removeEventListener("beforeunload", savePosition)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [savePosition])

  return (
    // The scroll area is 1px shorter than the screen, inside a full-height
    // wrapper that paints the same background. Chrome on Android promotes a
    // scroller that exactly fills the viewport to the page's root scroller,
    // and then scrolling it collapses the address bar: the screen grows
    // taller than every svh-sized section, and the next section shows
    // underneath (e.g. the features' top below Who's-it-for). Not filling the
    // viewport exactly keeps the toolbar, and so the screen height, fixed.
    // Every full-screen landing section sizes to --landing-screen (this
    // area's own height) rather than svh, so they still fit it exactly and
    // snap to their tops.
    <div className="h-svh bg-surface-3">
    <main
      ref={ref}
      tabIndex={-1}
      onScroll={onScroll}
      data-landing-scroll
      // --landing-rail: the width every left-aligned landing section lines up
      // to, so their left edges share one margin. It's the features section's
      // own width: its copy column, the gap, and its app shot (415 + 64 + 520).
      className={cn(
        "[--landing-rail:calc(var(--pad-9xl)*3+var(--pad-8xl)+var(--pad-sm)*2-var(--dist-2xs)+var(--dist-6xl))]",
        "[--landing-screen:calc(100svh-1px)]",
        "relative h-(--landing-screen) snap-y snap-mandatory overflow-x-clip overflow-y-auto bg-surface-3 text-text-bold outline-none",
        HIDE_NATIVE_SCROLLBAR_CLASSNAME
      )}
    >
      {children}
    </main>
    </div>
  )
}

export { LandingScrollArea }
