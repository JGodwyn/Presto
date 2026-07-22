"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma "Tooltip" (design-sync/tooltip) card radius — rad-xmd — as a literal
// px number for the squircle path math (see hooks/use-squircle-clip-path.ts).
const TOOLTIP_CORNER_RADIUS = 12

// The export's tail/pointer asset (Type=Down, Theme=light — assets/tooltip-
// pointers.svg) drawn once and rotated per side rather than swapped for one
// of the export's 4 direction-specific files: the Top/Left/Right variants
// are the same path mirrored/rotated (confirmed against tooltip-pointers-3
// and pointer.svg), so a single <path> covers every side.
function TooltipPointer({
  theme,
  className,
}: {
  theme: "light" | "dark"
  className?: string
}) {
  return (
    <TooltipPrimitive.Arrow
      data-slot="tooltip-arrow"
      className={cn(
        // Base shape points down (side=top, tooltip above the anchor).
        // Rotate clockwise/counterclockwise for the other three sides.
        "z-50 data-[side=bottom]:rotate-180 data-[side=left]:-rotate-90 data-[side=right]:rotate-90",
        className
      )}
    >
      <svg
        width="16"
        height="11"
        viewBox="0 0 16 11"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M9.73649 7.96115C8.9687 9.30478 7.0313 9.30478 6.26351 7.96115L1.70987 -0.00772251C0.94798 -1.34104 1.91071 -3 3.44636 -3L12.5536 -3C14.0893 -3 15.052 -1.34103 14.2901 -0.00772141L9.73649 7.96115Z"
          className={theme === "dark" ? "fill-surface-inverse" : "fill-surface-4"}
        />
      </svg>
    </TooltipPrimitive.Arrow>
  )
}

function TooltipProvider({
  delay = 600,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

interface TooltipContentProps
  extends React.ComponentProps<"div">,
    Pick<
      TooltipPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
    > {
  // Figma ships both as literal component variants (not a light/dark app
  // theme — this app is light-mode only per AGENTS.md). "dark" is the
  // default bubble for the light app surface, matching how surface-inverse
  // is already used elsewhere (navbar, sidebar); pass "light" for a tooltip
  // that needs to read against one of those dark surfaces instead.
  theme?: "light" | "dark"
}

function TooltipContent({
  className,
  style,
  side = "top",
  // dist-lg (16px) — the standard gap between a tooltip and whatever it's
  // pointing at (one step up from the previous dist-md/8px default),
  // hardcoded as a literal px number since Base UI's sideOffset is a plain
  // number, not a CSS value.
  sideOffset = 16,
  align = "center",
  alignOffset = 0,
  collisionPadding = 8,
  theme = "dark",
  children,
  ...props
}: TooltipContentProps) {
  // Base UI's Positioner already flips `side` and shifts/flips `align` to
  // keep the popup inside the viewport (collisionPadding below) — that's
  // the "best position for the available space" behavior; we just render
  // whichever side/align it lands on via the data-side/data-align it sets.
  const { ref: squircleRef, style: squircleStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: TOOLTIP_CORNER_RADIUS,
    })

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            // Figma drop shadow: 0 0 8 at 24% black — hardcoded, same
            // convention as menu.tsx's shadow (not a design token).
            "origin-(--transform-origin) drop-shadow-[0_0_8px_rgba(25,25,25,0.24)] transition-[transform,opacity] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none"
          )}
        >
          <div
            ref={squircleRef}
            style={{ ...style, ...squircleStyle }}
            className={cn(
              "flex items-center gap-dist-md rounded-rad-xmd px-pad-md py-pad-sm text-body-md",
              theme === "dark"
                ? "bg-surface-inverse text-text-inverse"
                : "bg-surface-4 text-text-bold",
              className
            )}
            {...props}
          >
            {children}
          </div>
          <TooltipPointer theme={theme} />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
