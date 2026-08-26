"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// --rad-xmd as px for the squircle path math. The dashboard's cards are
// rad-xmd (12), a notch tighter than the rad-lg (16) used by the Instructions
// cards and by the post cards inside the Next-up column.
const CARD_CORNER_RADIUS = 12
const CORNER_SMOOTHING = 1

// The dashboard's card shell, from the "DashboardDesign" export: surface-4,
// rad-xmd, pad-md block / pad-lg inline. Most cards carry no border — the
// canvas is surface-3, so white alone separates them; the three mini cards
// inside the Total-posts card *do* get one, because they sit on white.
export function DashboardCard({
  bordered = false,
  className,
  children,
}: {
  bordered?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const { ref, style } = useSquircleClipPath<HTMLElement>({
    cornerRadius: CARD_CORNER_RADIUS,
    cornerSmoothing: CORNER_SMOOTHING,
  })

  return (
    <section
      ref={ref}
      style={style}
      className={cn(
        // rounded-rad-xmd is the fallback shape until the clip-path is
        // measured on mount (see use-squircle-clip-path.ts).
        "flex flex-col rounded-rad-xmd bg-surface-4 px-pad-lg py-pad-md",
        bordered &&
          "border-[length:var(--stroke-md)] border-border-subtle px-pad-lg py-pad-sm",
        className
      )}
    >
      {children}
    </section>
  )
}

// Every section title on this page is body-lg-bold — the page's own project
// name is the only heading-sm on it.
export function DashboardCardTitle({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <h2 className={cn("text-body-lg-bold text-text-bold", className)}>
      {children}
    </h2>
  )
}
