"use client"

import * as React from "react"
import { Hourglass } from "@phosphor-icons/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

const CARD_CORNER_RADIUS = 16 // rad-lg

// Placeholder shown for each post while generation is in flight, from the
// Figma "Generate / Generating template" export — real content swaps in per
// card once its post is ready; every card starts in this loading state.
export function GeneratingPostCard() {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: CARD_CORNER_RADIUS,
  })

  return (
    <div
      ref={ref}
      style={style}
      className="flex h-92 w-70 shrink-0 flex-col gap-dist-md rounded-rad-lg border-[length:var(--stroke-xl)] border-dashed border-border-bold bg-surface-3 p-pad-lg"
    >
      <div className="flex items-center gap-dist-sm">
        <Hourglass className="size-6 text-icon-subtle" />
        <span className="text-body-lg-bold text-text-subtle">
          Generating…
        </span>
      </div>
    </div>
  )
}
