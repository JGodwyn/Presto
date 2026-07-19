"use client"

import * as React from "react"
import Image from "next/image"
import { Info } from "@phosphor-icons/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma --rad-lg as px for the squircle path math (the panel) and --rad-md
// (the info corner tag).
const PANEL_CORNER_RADIUS = 16
const INFO_CORNER_RADIUS = 8

// The white page-level panel from the "Generate (Number based)" export: green
// pixel-gradient glows bleeding in from the top and bottom edges (one image,
// mirrored — the export ships two near-identical copies), an info marker in
// the top-right corner, and the settings card floating over it. The glow art
// has a baked-in white background, matching the panel's own surface-4.
export function GeneratePanel({ children }: { children: React.ReactNode }) {
  const { ref: panelRef, style: panelStyle } =
    useSquircleClipPath<HTMLElement>({ cornerRadius: PANEL_CORNER_RADIUS })
  const { ref: infoRef, style: infoStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: INFO_CORNER_RADIUS })

  return (
    <section
      ref={panelRef}
      style={panelStyle}
      className="relative flex flex-1 flex-col overflow-hidden rounded-rad-lg bg-surface-4"
    >
      {/* The export places the art at 1157px on a 920px panel — wider than
          its container, cropped at the sides. The calc keeps that ratio at
          any panel width; overflow-hidden above does the cropping. */}
      <Image
        src="/images/generate/pixel-glow.webp"
        alt=""
        width={1157}
        height={868}
        priority
        className="pointer-events-none absolute top-0 left-1/2 w-[calc(100%*1157/920)] max-w-none -translate-x-1/2 -translate-y-[8%] -scale-y-100"
      />
      <Image
        src="/images/generate/pixel-glow.webp"
        alt=""
        width={1157}
        height={868}
        priority
        className="pointer-events-none absolute bottom-0 left-1/2 w-[calc(100%*1157/920)] max-w-none -translate-x-1/2 translate-y-1/8"
      />

      {/* Static marker in the export — no defined behavior yet, so it stays
          a plain element rather than a do-nothing button. */}
      <div
        ref={infoRef}
        style={infoStyle}
        className="absolute top-pad-lg right-pad-lg flex size-8 items-center justify-center rounded-rad-md bg-surface-3"
      >
        <Info className="size-6 text-icon-subtle" />
      </div>

      <div className="relative flex flex-1 flex-col">{children}</div>
    </section>
  )
}
