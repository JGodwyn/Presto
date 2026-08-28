"use client"

import * as React from "react"
import { CaretRight } from "@phosphor-icons/react"

import { DottedDivider } from "@/components/instructions/dotted-divider"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"

// Figma --rad-lg as px for the squircle path math — see
// hooks/use-squircle-clip-path.ts.
const CARD_CORNER_RADIUS = 16

// Per .agents/skills/review-animations/STANDARDS.md:
//
// - **Duration.** A disclosure sits in the "dropdowns, selects" band
//   (150–250ms). Open and close are asymmetric — "slow where the user is
//   deciding, fast where the system responds" — so closing, which is
//   dismissal, is the quicker of the two.
// - **Easing.** Entering/exiting → ease-out, and the built-in curves are too
//   weak, so this is the standards' own strong ease-out. Closing uses it too:
//   never ease-in on UI, in either direction.
//   The curve itself is written literally as `ease-[cubic-bezier(0.23,1,0.32,1)]`
//   at each use below rather than kept in a constant — Tailwind only sees
//   class strings it can read in the source.
const OPEN_MS = 220
const CLOSE_MS = 160

// The content's own fade is deliberately offset from the height change rather
// than running alongside it: opening, it waits until there's room to appear
// in; closing, it's gone before the edge reaches it, so text never smears
// against the collapsing boundary. Both stay well inside their own phase.
const CONTENT_FADE_MS = 140
const CONTENT_OPEN_DELAY_MS = 60

interface ProfileDisclosureProps {
  icon: React.ElementType
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  // The export gives the two panels different gaps below the header —
  // dist-md for Change password, dist-lg for AI models — so it's the caller's
  // call rather than a constant here.
  contentGapClassName?: string
  children: React.ReactNode
}

// One expandable row of the Profile menu (Figma "profilescreenexpanded"):
// collapsed it is the 312×40 row from the base export; open it grows in place
// to hold its panel, and the caret turns to point up.
export function ProfileDisclosure({
  icon: Icon,
  label,
  open,
  onOpenChange,
  contentGapClassName = "pt-dist-md",
  children,
}: ProfileDisclosureProps) {
  const panelId = React.useId()
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: CARD_CORNER_RADIUS,
  })

  const duration = open ? OPEN_MS : CLOSE_MS

  return (
    <div
      ref={ref}
      style={style}
      className="w-full rounded-rad-lg bg-surface-4 py-pad-sm pr-pad-sm pl-pad-md"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className="flex h-6 w-full cursor-pointer items-center gap-dist-lg text-left"
      >
        <span className="flex shrink-0 items-center gap-dist-md">
          <Icon weight="bold" className="size-5 text-icon-subtle" />
          <span className="text-body-lg-bold text-text-bold">{label}</span>
        </span>
        <DottedDivider className="min-w-0 flex-1" />
        {/* The export's caret is CaretRight closed and CaretUp open — the
            same glyph a quarter turn anticlockwise, so it can rotate rather
            than swap. A transform, per the standards' performance rule. */}
        <CaretRight
          weight="bold"
          style={{ transitionDuration: `${duration}ms` }}
          className={cn(
            "size-5 shrink-0 text-icon-subtle transition-[rotate] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
            open && "-rotate-90"
          )}
        />
      </button>

      {/*
        Height animates via grid-template-rows 0fr → 1fr. Two reasons this,
        rather than the transform/opacity the standards otherwise insist on:
        an accordion has to change layout height or it can't push the rows
        below it, and no transform can do that; and this is a *transition*,
        which the standards call for on anything a user can trigger rapidly —
        it retargets from wherever it is when toggled mid-flight, where
        keyframes would restart from zero. The cost is one small subtree
        relaying out.
      */}
      <div
        id={panelId}
        // `inert` rather than `hidden`: the panel has to stay in the layout
        // for its height to animate, but nothing inside a closed one should
        // be tabbable or reachable by a screen reader.
        inert={!open}
        style={{ transitionDuration: `${duration}ms` }}
        className={cn(
          "grid transition-[grid-template-rows] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div
            style={{
              transitionDuration: `${CONTENT_FADE_MS}ms`,
              transitionDelay: open ? `${CONTENT_OPEN_DELAY_MS}ms` : "0ms",
            }}
            className={cn(
              // The export's expanded card has 12px of bottom padding against
              // the collapsed row's 8px. Carrying the extra 4px here, inside
              // the animated region, keeps the card's own padding constant —
              // animating the padding itself would be a second layout
              // property fighting the first.
              "pb-pad-xs transition-[opacity,translate] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:translate-y-0 motion-reduce:transition-[opacity]",
              contentGapClassName,
              open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
