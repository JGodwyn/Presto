"use client"

import * as React from "react"

import { SectionSpinner } from "@/components/shared/section-spinner"
import { reportSectionLoadingBoundary } from "@/lib/section-navigation"

// Shared instant-loading state for every in-project section (dashboard,
// instructions, generate, …): the chrome (navbar + sidebar) stays put while
// the incoming page streams in behind a centered spinner. This boundary also
// lets the router commit section navigations immediately, so the URL — and
// with it the sidebar's real active state — updates without waiting for the
// page's server work.
//
// It only appears once the router *commits*, though, which is why
// components/shared/section-content.tsx shows the same spinner from the tap
// itself; this covers the cases that never go through a sidebar tab (a direct
// URL, a deep link, back/forward).
//
// A client component solely so it can report its own mounted window: while
// this fallback is on screen a navigation is mid-stream, and a tab tapped
// during that window puts the overlay up with no delay — see
// lib/section-navigation.ts for the stale-content flash this closes.
export default function ProjectSectionLoading() {
  React.useEffect(() => {
    reportSectionLoadingBoundary(true)
    return () => reportSectionLoadingBoundary(false)
  }, [])

  return (
    <div className="flex flex-1 items-center justify-center">
      <SectionSpinner />
    </div>
  )
}
