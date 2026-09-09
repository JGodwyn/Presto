"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma "Tooltip" (design-sync/tooltip) card radius — rad-xmd — as a literal
// px number for the squircle path math (see hooks/use-squircle-clip-path.ts).
const TOOLTIP_CORNER_RADIUS = 12

// The export's top pointer asset (assets/tooltip-pointers.svg) drawn once and
// rotated per side. Base UI supplies the cross-axis position but deliberately
// leaves the side placement to CSS, so each side anchors the pointer just
// outside the popup instead of letting it sit in normal flow below the card.
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
        // Base shape points up (side=bottom, tooltip below the anchor), exactly
        // as exported. `*-full` keeps the point touching the popup edge without
        // introducing a made-up pixel offset.
        "absolute z-50 data-[side=bottom]:bottom-full data-[side=top]:top-full data-[side=top]:rotate-180 data-[side=left]:left-full data-[side=left]:rotate-90 data-[side=right]:right-full data-[side=right]:-rotate-90",
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
          d="M6.26351 3.03885C7.0313 1.69522 8.9687 1.69522 9.73649 3.03885L14.2901 11.0077C15.052 12.341 14.0893 14 12.5536 14L3.44636 14C1.91071 14 0.94798 12.341 1.70987 11.0077L6.26351 3.03885Z"
          className={theme === "dark" ? "fill-surface-inverse" : "fill-surface-4"}
        />
      </svg>
    </TooltipPrimitive.Arrow>
  )
}

// The app-wide open delay. One Provider in app/layout.tsx applies it to every
// tooltip; Base UI resolves a provider-less trigger against its own 600ms
// default, which is why the global Provider exists rather than this default
// alone. A nested Provider can still override it for one group.
const TOOLTIP_OPEN_DELAY_MS = 200

function TooltipProvider({
  delay = TOOLTIP_OPEN_DELAY_MS,
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
            "drop-shadow-[0_0_8px_rgba(25,25,25,0.24)]",
            // Grows out of whatever it's pointing at. Base UI's Positioner
            // publishes --transform-origin as the anchor's own edge — for a
            // tooltip above its trigger that resolves to "50% calc(100% +
            // 16px)", i.e. the sideOffset gap below the bubble — so the
            // bubble scales up *and* rises the last few pixels into place
            // rather than swelling from its own middle.
            "origin-(--transform-origin)",
            // The scale is what animates, so `scale` is what has to be in the
            // transition list. It said `transform` before, which is a
            // different CSS property from the standalone `scale` these
            // utilities set — so the tooltip snapped to full size and only
            // the fade ever ran.
            //
            // Opacity is on its own shorter, plain ease-out: the scale's
            // over-extend curve (app/globals.css) deliberately passes its
            // target, which on opacity would clamp at 1 and flicker.
            "[transition:scale_200ms_var(--ease-over-extend),opacity_130ms_cubic-bezier(0.23,1,0.32,1)]",
            "data-starting-style:scale-90 data-starting-style:opacity-0",
            // Leaving is quick and plain — an over-extend on the way out
            // pulls the eye back to something that's going away.
            "data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-ending-style:[transition:scale_130ms_cubic-bezier(0.23,1,0.32,1),opacity_130ms_cubic-bezier(0.23,1,0.32,1)]",
            "motion-reduce:transition-none"
          )}
        >
          <div
            ref={squircleRef}
            style={{ ...style, ...squircleStyle }}
            className={cn(
              // Long tooltip copy wraps at the app's standard tooltip width;
              // a tooltip is explanatory text, never an internal scroller.
              "flex max-w-66 items-center gap-dist-md rounded-rad-xmd px-pad-md py-pad-sm text-body-md whitespace-normal",
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
