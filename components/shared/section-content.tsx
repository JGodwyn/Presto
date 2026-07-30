"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { SectionSpinner } from "@/components/shared/section-spinner"
import {
  endSectionNavigation,
  getSectionNavigation,
  getSectionNavigationServerSnapshot,
  subscribeToSectionNavigation,
} from "@/lib/section-navigation"

// Long enough that a warm, already-prefetched section never shows a spinner at
// all — most tab switches land well inside this. Skipped entirely when the
// navigation was armed mid-stream (`nav.instant`): a spinner is already on
// screen then, and the delay's only job — keeping fast navigations
// spinner-free — doesn't apply, while the uncovered window it opens is exactly
// where a superseded navigation's stale content can flash (see
// lib/section-navigation.ts).
const SHOW_DELAY_MS = 120
// Once it *has* appeared, it stays put for at least this long. Without it, a
// navigation that finishes just past SHOW_DELAY_MS puts a spinner on screen
// for a frame or two and takes it away again, which reads as a glitch rather
// than as loading.
const MIN_VISIBLE_MS = 300
// Escape hatch: a click the router ends up not honouring (cancelled, or a
// redirect somewhere the target never matches) would otherwise leave the
// overlay up forever, since arrival is the only thing that clears it.
const MAX_VISIBLE_MS = 10_000

// Covers the in-project page area from the moment a sidebar tab is tapped,
// rather than from whenever the router finishes committing — which is all
// loading.tsx can manage. See lib/section-navigation.ts for why the pending
// state has to travel through a store to get here, and why it carries the
// destination href rather than a boolean.
//
// That href is what closes the overlay: it stays up until `usePathname()` has
// actually reached the destination, so it can only ever hand over to the new
// page (or to loading.tsx's identical spinner). Ending on anything earlier —
// the link's own pending flag, say, which flips as soon as history updates —
// means the overlay can lift while the outgoing page is still mounted
// underneath it, which is exactly the flash of the previous section that was
// reported.
//
// It is deliberately a hard cut, not a cross-fade. A fade means a window where
// two layers are both partly visible, and the layer *underneath* changes
// identity during that window. Opacity is either 0 or 1 here, and the delay
// and minimum above are what stop a fast navigation from flashing the spinner
// instead.
//
// Also deliberately an overlay rather than swapping `children` out, so the
// outgoing page keeps its DOM and scroll position until the new one is ready.
export function SectionContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const nav = React.useSyncExternalStore(
    subscribeToSectionNavigation,
    getSectionNavigation,
    getSectionNavigationServerSnapshot
  )
  // startsWith, not equality: landing on a sub-route of the tapped section
  // (generate → generate/generating) still counts as having arrived.
  const pending = nav !== null && !pathname.startsWith(nav.href)

  const [visible, setVisible] = React.useState(false)
  const shownAtRef = React.useRef(0)

  // Arrived — release the target so the next tap starts from a clean slate.
  React.useEffect(() => {
    if (nav !== null && !pending) endSectionNavigation()
  }, [nav, pending])

  React.useEffect(() => {
    if (pending) {
      // Already up — leave it alone rather than restarting its clock, which
      // would keep pushing the minimum-visible window further out.
      if (visible) return
      // The instant path is already on screen via `showOverlay` below — this
      // only commits `visible` so the minimum-visible clock has state to run
      // against, hence a zero timeout rather than a synchronous set.
      const timer = setTimeout(
        () => {
          shownAtRef.current = Date.now()
          setVisible(true)
        },
        nav.instant ? 0 : SHOW_DELAY_MS
      )
      return () => clearTimeout(timer)
    }

    if (!visible) return
    const remaining = Math.max(
      0,
      MIN_VISIBLE_MS - (Date.now() - shownAtRef.current)
    )
    const timer = setTimeout(() => setVisible(false), remaining)
    return () => clearTimeout(timer)
  }, [nav, pending, visible])

  React.useEffect(() => {
    if (!pending) return
    const timer = setTimeout(endSectionNavigation, MAX_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [pending])

  // The store outlives this component, and only arriving at the target clears
  // it — so a tab tapped and then abandoned by leaving the project entirely
  // (back button, a redirect to /login) would strand that href and greet the
  // next project with an overlay it has no way to satisfy.
  React.useEffect(() => endSectionNavigation, [])

  // The instant path renders the overlay from the arming render itself — in
  // the same synchronous pass as the click — rather than waiting for the
  // effect above to commit `visible`. The stale content it exists to cover
  // arrives on a network task that could otherwise slip in before a passive
  // effect gets to run; `visible` still catches up so the minimum-visible
  // window has a clock to run against.
  const showOverlay = visible || (pending && nav.instant)

  return (
    // flex-1/flex-col so pages that rely on being a flex child of <main>
    // (every one of them — they use flex-1 to fill it) are unaffected.
    <div className="relative flex flex-1 flex-col">
      {children}
      {showOverlay && (
        // bg-surface-3 is the page canvas, so the outgoing content is hidden
        // rather than showing through behind the spinner.
        <div className="absolute inset-0 bg-surface-3">
          {/* sticky rather than centred in the overlay itself: <main> is the
              scroll container, and on a long page (Instructions) an overlay
              centred across its full height would put the spinner somewhere
              off-screen. This keeps it in the middle of what's actually
              visible. */}
          <div className="sticky top-1/2 flex -translate-y-1/2 justify-center">
            <SectionSpinner />
          </div>
        </div>
      )}
    </div>
  )
}
