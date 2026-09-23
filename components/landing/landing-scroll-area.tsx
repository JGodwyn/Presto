"use client"

import * as React from "react"

const LANDING_SCROLL_POSITION_KEY = "presto:landing-scroll-position"

function LandingScrollArea({ children }: { children: React.ReactNode }) {
  const scrollAreaRef = React.useRef<HTMLElement | null>(null)
  const hasRestoredRef = React.useRef(false)
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const savePosition = React.useCallback(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return
    sessionStorage.setItem(
      LANDING_SCROLL_POSITION_KEY,
      String(scrollArea.scrollTop)
    )
  }, [])

  const ref = React.useCallback((node: HTMLElement | null) => {
    scrollAreaRef.current = node
    if (!node || hasRestoredRef.current) return

    hasRestoredRef.current = true
    const savedPosition = Number(sessionStorage.getItem(LANDING_SCROLL_POSITION_KEY))
    sessionStorage.removeItem(LANDING_SCROLL_POSITION_KEY)
    if (Number.isFinite(savedPosition) && savedPosition > 0) {
      // Hydration, hash handling, and scroll-snap all settle just after refs
      // attach. Re-apply on the following two frames so none of those browser
      // passes can overwrite the restored inner-container offset with zero.
      requestAnimationFrame(() => {
        node.scrollTop = savedPosition
        requestAnimationFrame(() => {
          node.scrollTop = savedPosition
        })
      })
    }
  }, [])

  const onScroll = React.useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(savePosition, 100)
  }, [savePosition])

  React.useEffect(() => {
    window.addEventListener("beforeunload", savePosition)
    return () => {
      window.removeEventListener("beforeunload", savePosition)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [savePosition])

  return (
    <main
      ref={ref}
      onScroll={onScroll}
      data-landing-scroll
      className="relative h-dvh snap-y snap-proximity overflow-x-clip overflow-y-auto bg-surface-3 text-text-bold"
    >
      {children}
    </main>
  )
}

export { LandingScrollArea }
