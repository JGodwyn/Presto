"use client"

import * as React from "react"
import Image from "next/image"
import { Info } from "@phosphor-icons/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"

// Figma --rad-lg as px for the squircle path math (the panel) and --rad-md
// (the info corner tag).
const PANEL_CORNER_RADIUS = 16
const INFO_CORNER_RADIUS = 8

// The white page-level panel shared by Generate and Content: green pixel-
// gradient glows bleeding in from the top and bottom edges (one image,
// mirrored — the export ships two near-identical copies), an info marker in
// the top-right corner, and the page's own content floating over it. The glow
// art has a baked-in white background, matching the panel's own surface-4.
//
// Both exports (design-sync/generate-number-based, design-sync/
// content-base-calendar-view) draw this identically down to the corner
// marker's 32px/rad-md/surface-3, which is why it lives here rather than in
// either feature folder. The artwork keeps its original /images/generate/
// path — it's the same file, and moving it would only churn the asset.
export function GlowPanel({
  children,
  cornerAction,
  showInfoMarker = true,
  className,
}: {
  children: React.ReactNode
  // Rendered to the left of the info marker, in the same corner cluster —
  // e.g. Generate's reset-calendar button. Optional and only rendered when
  // passed, same convention as ProjectsNavbar's `backHref`.
  cornerAction?: React.ReactNode
  // Off for a page that puts its own controls in that corner — the post
  // details screen, whose export shows its three actions there and no marker.
  showInfoMarker?: boolean
  className?: string
}) {
  const { ref: panelRef, style: panelStyle } =
    useSquircleClipPath<HTMLElement>({ cornerRadius: PANEL_CORNER_RADIUS })
  const { ref: infoRef, style: infoStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: INFO_CORNER_RADIUS })

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
      // The panel is exactly the viewport's leftover height, never taller:
      // `flex-1` fills it, and clipping (needed anyway to crop the oversized
      // glow art) zeroes its automatic minimum size so long content can't push
      // it past that. Pages with more content than fits scroll it *inside* the
      // panel — per direct feedback that scrolling the whole page felt wrong —
      // so whatever they pin (Content's title and tabs) stays put while the
      // rest moves. Such a page has to give its own scroll area a bounded
      // height: `min-h-0 flex-1` on the column, `overflow-y-auto` on the part
      // that scrolls.
      //
      // overflow-**clip**, not hidden: `hidden` still makes this a scroll
      // container, and the glow art below is deliberately wider than the panel
      // (163px of it, split either side), so the panel had a scrollable
      // overflow nothing was meant to reach. Anything that scrolls an element
      // into view — a focus, an assistive click — could shove the entire page
      // content sideways and leave it there, which is exactly what happened.
      // `clip` crops identically and is never scrollable.
      //
      // `min-h-0` is not decoration next to it, and leaving it off is a bug
      // that has already been made once: a flex item's automatic minimum size
      // is its content, and while `overflow: hidden` zeroes that as a side
      // effect, **`clip` does not** — so the panel grew to its full content
      // height, overflowed the box meant to cap it, and the whole page went
      // back to scrolling. Say it explicitly instead of relying on either
      // overflow value to imply it.
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-clip rounded-rad-lg bg-surface-4",
        className
      )}
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

      {/* z-10: without an explicit stack order this sits behind the content
          column below (also `position: relative`, and later in the DOM —
          two positioned siblings at the same implicit z-index stack in DOM
          order, later wins) even though the content column paints nothing
          visible over this corner. The overlap silently ate every real
          pointer event aimed at these buttons — clicks landed on empty
          space in the content column instead of the button underneath it. */}
      <div className="absolute top-pad-lg right-pad-lg z-10 flex items-center gap-dist-md">
        {cornerAction}
        {/* Static marker in the Generate and Content exports — no defined
            behavior yet, so it stays a plain element rather than a do-nothing
            button. Still gets the same tap-scale feedback as a real button per
            direct feedback, even with nothing wired to the press. */}
        {showInfoMarker ? (
          <div
            ref={infoRef}
            style={infoStyle}
            className="flex size-8 items-center justify-center rounded-rad-md bg-surface-3 transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <Info className="size-6 text-icon-subtle" />
          </div>
        ) : null}
      </div>

      {/* min-h-0 so a scrolling child can actually be bounded by this box
          rather than sized by its own content. */}
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}
