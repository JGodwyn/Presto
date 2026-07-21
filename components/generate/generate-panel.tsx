"use client"

import * as React from "react"
import Image from "next/image"
import { Info, PaintBrushHousehold } from "@phosphor-icons/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma --rad-lg as px for the squircle path math (the panel) and --rad-md
// (the info corner tag, shared by the reset button below it).
const PANEL_CORNER_RADIUS = 16
const INFO_CORNER_RADIUS = 8
const RESET_BUTTON_CORNER_RADIUS = 8

// The white page-level panel from the "Generate (Number based)" export: green
// pixel-gradient glows bleeding in from the top and bottom edges (one image,
// mirrored — the export ships two near-identical copies), an info marker in
// the top-right corner, and the settings card floating over it. The glow art
// has a baked-in white background, matching the panel's own surface-4.
export function GeneratePanel({
  children,
  onResetCalendar,
}: {
  children: React.ReactNode
  // Not in the export — a direct request, wired to whatever calendar
  // selection state the caller owns. Optional and only rendered when
  // passed, same pattern as ProjectsNavbar's `backHref`.
  onResetCalendar?: () => void
}) {
  const { ref: panelRef, style: panelStyle } =
    useSquircleClipPath<HTMLElement>({ cornerRadius: PANEL_CORNER_RADIUS })
  const { ref: infoRef, style: infoStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: INFO_CORNER_RADIUS })
  const { ref: resetRef, style: resetStyle } =
    useSquircleClipPath<HTMLButtonElement>({
      cornerRadius: RESET_BUTTON_CORNER_RADIUS,
    })

  return (
    <section
      ref={panelRef}
      style={panelStyle}
      // data-clip-boundary: a JS hook, not a style — the skip-dates
      // carousel (components/generate/generate-calendar-column.tsx) walks
      // up to this exact element via closest() to measure how much
      // horizontal room it can safely bleed into before this panel's own
      // overflow-hidden (below) would clip it. Measuring against
      // window.innerWidth instead used to leave the carousel's own claimed
      // viewport wider than what was actually paintable once page padding
      // and the sidebar were accounted for, making the last calendar
      // unreachable no matter how far you scrolled.
      data-clip-boundary
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

      <div className="absolute top-pad-lg right-pad-lg flex items-center gap-dist-sm">
        {onResetCalendar ? (
          <button
            ref={resetRef}
            style={resetStyle}
            type="button"
            aria-label="Reset calendar selection"
            onClick={onResetCalendar}
            className="flex size-8 cursor-pointer items-center justify-center rounded-rad-md bg-surface-3 text-icon-subtle outline-none transition-colors duration-150 ease-out hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)] hover:text-icon-bold focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PaintBrushHousehold className="size-6" />
          </button>
        ) : null}
        {/* Static marker in the export — no defined behavior yet, so it
            stays a plain element rather than a do-nothing button. */}
        <div
          ref={infoRef}
          style={infoStyle}
          className="flex size-8 items-center justify-center rounded-rad-md bg-surface-3"
        >
          <Info className="size-6 text-icon-subtle" />
        </div>
      </div>

      <div className="relative flex flex-1 flex-col">{children}</div>
    </section>
  )
}
