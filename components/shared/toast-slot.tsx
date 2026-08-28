"use client"

import * as React from "react"
import { createPortal } from "react-dom"

// The app's standard toast position — fixed, top-centre — portalled to
// <body>.
//
// **The portal is the whole point.** A `position: fixed` element is laid out
// against the viewport, but any ancestor carrying a `clip-path` becomes its
// containing block *and* clips it, so a toast rendered inside one lands
// wherever that ancestor is and gets cropped to its shape. This app puts
// clip-paths everywhere — every squircled card, GlowPanel, the Profile
// disclosures — so a toast raised from inside a card appears to slide out of
// the card rather than down from the top of the screen. day-deck.tsx and
// post-details.tsx both hit this before it was worth extracting.
//
// Reach for this for any toast raised from inside a card. A toast rendered at
// page level doesn't need it, but it costs nothing there either.
export function ToastSlot({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  // Deliberately *not* gated on whether a toast is currently open: the toast's
  // own presence is what plays its exit animation, so unmounting the portal
  // target with it would tear that out mid-exit. These pages server-render, so
  // `document` doesn't exist on the first pass — read through
  // useSyncExternalStore rather than an effect that calls setState (which
  // trips react-hooks/set-state-in-effect), the same "server snapshot differs
  // from the client one" shape as lib/network-status.ts.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!mounted) return null

  return createPortal(
    <div
      className={
        className ??
        "pointer-events-none fixed inset-x-0 top-pad-2xl z-50 flex justify-center"
      }
    >
      {children}
    </div>,
    document.body
  )
}
