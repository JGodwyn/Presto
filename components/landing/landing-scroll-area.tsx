"use client"

import * as React from "react"

const LANDING_SCROLL_POSITION_KEY = "presto:landing-scroll-position"
const LANDING_FEATURES_SCROLL_POSITION_KEY = "presto:landing-features-scroll-position"

function LandingScrollArea({ children }: { children: React.ReactNode }) {
  const scrollAreaRef = React.useRef<HTMLElement | null>(null)
  const hasRestoredRef = React.useRef(false)
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const savePosition = React.useCallback(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return
    const featuresArea = scrollArea.querySelector<HTMLElement>("[data-landing-features-scroll]")
    sessionStorage.setItem(
      LANDING_SCROLL_POSITION_KEY,
      String(scrollArea.scrollTop)
    )
    if (featuresArea) {
      sessionStorage.setItem(
        LANDING_FEATURES_SCROLL_POSITION_KEY,
        String(featuresArea.scrollTop)
      )
    }
  }, [])

  const ref = React.useCallback((node: HTMLElement | null) => {
    scrollAreaRef.current = node
    if (!node || hasRestoredRef.current) return

    hasRestoredRef.current = true
    const savedPosition = Number(sessionStorage.getItem(LANDING_SCROLL_POSITION_KEY))
    const savedFeaturesPosition = Number(
      sessionStorage.getItem(LANDING_FEATURES_SCROLL_POSITION_KEY)
    )
    sessionStorage.removeItem(LANDING_SCROLL_POSITION_KEY)
    sessionStorage.removeItem(LANDING_FEATURES_SCROLL_POSITION_KEY)
    if (
      (Number.isFinite(savedPosition) && savedPosition > 0) ||
      (Number.isFinite(savedFeaturesPosition) && savedFeaturesPosition > 0)
    ) {
      const restore = () => {
        if (Number.isFinite(savedPosition) && savedPosition > 0) {
          node.scrollTop = savedPosition
        }
        if (Number.isFinite(savedFeaturesPosition) && savedFeaturesPosition > 0) {
          const featuresArea = node.querySelector<HTMLElement>("[data-landing-features-scroll]")
          if (featuresArea) featuresArea.scrollTop = savedFeaturesPosition
        }
      }
      // Hydration and hash handling can settle just after refs attach.
      // Re-apply on the following two frames so none of those browser
      // passes can overwrite the restored inner-container offset with zero.
      requestAnimationFrame(() => {
        restore()
        requestAnimationFrame(restore)
      })
    }
  }, [])

  const onScroll = React.useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(savePosition, 100)
  }, [savePosition])

  React.useEffect(() => {
    const featuresArea = scrollAreaRef.current?.querySelector<HTMLElement>(
      "[data-landing-features-scroll]"
    )
    featuresArea?.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("beforeunload", savePosition)
    return () => {
      featuresArea?.removeEventListener("scroll", onScroll)
      window.removeEventListener("beforeunload", savePosition)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [onScroll, savePosition])

  return (
    <main
      ref={ref}
      onScroll={onScroll}
      data-landing-scroll
      className="relative h-svh overflow-x-clip overflow-y-auto bg-surface-3 text-text-bold"
    >
      {children}
    </main>
  )
}

export { LandingScrollArea }
