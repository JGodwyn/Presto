"use client"

import * as React from "react"
import { PaintBrushHousehold } from "@phosphor-icons/react"

import { GlowPanel } from "@/components/shared/glow-panel"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma --rad-md as px for the squircle path math.
const RESET_BUTTON_CORNER_RADIUS = 8

// The Generate page's panel: the app's shared GlowPanel (green pixel-gradient
// glows + the corner info marker — see components/shared/glow-panel.tsx,
// which the Content page draws from the same Figma treatment) plus this
// page's own reset-calendar button in the corner cluster.
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
  const { ref: resetRef, style: resetStyle } =
    useSquircleClipPath<HTMLButtonElement>({
      cornerRadius: RESET_BUTTON_CORNER_RADIUS,
    })

  return (
    <GlowPanel
      // Off per direct request: the marker was static, with no behavior
      // wired to it, and this corner already carries a control that does
      // something. GlowPanel keeps drawing it for the Content page.
      showInfoMarker={false}
      cornerAction={
        onResetCalendar ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  ref={resetRef}
                  style={resetStyle}
                  type="button"
                  aria-label="Reset calendar selection"
                  onClick={onResetCalendar}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-rad-md bg-surface-3 text-icon-subtle outline-none transition-[color,background-color,scale] duration-150 ease-out hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)] hover:text-icon-bold focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
                >
                  <PaintBrushHousehold className="size-6" />
                </button>
              }
            />
            <TooltipContent>Reset changes</TooltipContent>
          </Tooltip>
        ) : null
      }
    >
      {children}
    </GlowPanel>
  )
}
