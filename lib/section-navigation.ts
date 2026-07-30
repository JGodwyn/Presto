"use client"

// Tracks where an in-project section navigation is headed, so the page area
// can put its spinner up from the moment a tab is tapped and keep it up until
// the new page is genuinely on screen.
//
// The section's loading.tsx can't do the first half on its own: that boundary
// only renders once the router *commits*, which waits on the server. On a slow
// section that left the previous page sitting there with no spinner at all.
//
// `useLinkStatus` is the obvious tool for the tap-time half, and this used to
// use it — but it can't carry either end reliably. Next's own docs describe
// its pending flag as "true before history updates, false after", and note it
// is *skipped entirely* for a route that has already been prefetched, which
// every sidebar link is. So it ends on the URL changing rather than on the new
// tree being painted, and in the common warm case it never starts at all.
//
// What this stores instead is the destination href, reported from the link's
// own click handler and cleared once `usePathname()` has reached it. Both ends
// are then things that cannot happen early: the start is the click itself, and
// the end is the router commit that renders the new page — so the overlay can
// never lift back onto the outgoing page, which is what produced the reported
// flash of the previous section.
//
// A module-level store rather than context (same pattern as
// lib/network-status.ts) so nothing has to be threaded through the layout:
// components/shared/project-sidebar.tsx reports, and
// components/shared/section-content.tsx subscribes.
//
// The latest click wins rather than being counted: tapping a second tab while
// the first is still in flight means the destination *changed*, so the overlay
// should stay up until that second route lands, not drop when the first one
// does.
//
// `instant` exists because the router will happily commit a *superseded*
// navigation's late-arriving content: click A, then click B while A is still
// streaming, and A's content paints in full the moment its response lands —
// before B commits anything — for anywhere from a frame to several hundred
// milliseconds (measured 17-425ms against the dev server). The overlay covers
// that flash whenever it's up, but its normal show delay leaves the first
// SHOW_DELAY_MS uncovered. So a navigation armed while another one is already
// in flight — the previous target never arrived, or the route's loading
// fallback is currently mounted — skips the delay entirely: the delay exists
// to keep warm, settled-page navigations spinner-free, and a mid-stream click
// is never that case (a spinner is already on screen).

export type SectionNavigation = {
  href: string
  // Show the overlay immediately instead of after the show delay — set when
  // this navigation was armed while a previous one was still in flight.
  instant: boolean
}

let nav: SectionNavigation | null = null
let loadingBoundaryMounted = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeToSectionNavigation(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSectionNavigation() {
  return nav
}

// The server never has a navigation in flight, and useSyncExternalStore needs
// this snapshot to be stable.
export function getSectionNavigationServerSnapshot(): SectionNavigation | null {
  return null
}

// Called by the route's loading.tsx on mount/unmount. While the fallback is
// mounted a navigation is mid-stream, which is what decides `instant` above.
// Read at arming time only — no emit, nothing renders from it directly.
export function reportSectionLoadingBoundary(mounted: boolean) {
  loadingBoundaryMounted = mounted
}

export function startSectionNavigation(href: string) {
  if (nav?.href === href) return
  nav = { href, instant: nav !== null || loadingBoundaryMounted }
  emit()
}

export function endSectionNavigation() {
  if (nav === null) return
  nav = null
  emit()
}
