"use client"

import { SpinnerGap } from "@phosphor-icons/react"

// The one in-project loading indicator, shared by the route's loading.tsx and
// by section-content.tsx's tap-time overlay so the two are literally the same
// spinner in the same place — the overlay hands over to the boundary mid-
// navigation and nothing about it should visibly change.
//
// Spin is linear per the animation standards (constant motion → linear), and
// there's no entrance animation: a loading state should appear the instant
// it's needed.
export function SectionSpinner() {
  return (
    <SpinnerGap
      weight="bold"
      className="size-8 animate-spin text-text-subtle"
    />
  )
}
