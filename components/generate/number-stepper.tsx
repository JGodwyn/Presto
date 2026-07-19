"use client"

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { Minus, Plus } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma --rad-lg as px for the squircle path math. The 4px ring is drawn as
// a CSS border inside a 64×56 box so the border-box matches the export's
// outer (stroke-aligned-outside) silhouette.
const STEP_BUTTON_CORNER_RADIUS = 16

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: STEP_BUTTON_CORNER_RADIUS,
  })
  return (
    <button
      ref={ref}
      style={style}
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      // relative so the button paints over the connector line tucked under
      // its edge (positioned elements paint above static siblings). Disabled
      // recolors (gray-100 fill / gray-200 stroke / icon-minimal glyph)
      // instead of dropping opacity — a translucent button would let that
      // tucked-under line show through it.
      className="relative flex h-14 w-16 shrink-0 cursor-pointer items-center justify-center rounded-rad-lg border-[length:var(--stroke-xl)] border-gray-600 bg-gray-400 text-text-inverse transition-[background-color,border-color,color,translate,scale] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-92 disabled:cursor-default disabled:border-gray-200 disabled:bg-gray-100 disabled:text-icon-minimal disabled:active:scale-100"
    >
      {children}
    </button>
  )
}

// The export's connector (line-6/line-7.svg): a stroke running flush from
// the button's edge into a circular head that hugs the count. Drawn as
// elements instead of the exported SVGs so the color stays a token. The
// line's button end extends dist-md *under* the button (negative margin,
// extra length — net footprint unchanged) so the press scale-down never
// opens a gap between them; `dimmed` recolors the pair to gray-200 in step
// with the adjacent button's disabled state (recolor, not opacity — same
// show-through reason as the button itself).
function Connector({ side, dimmed }: { side: "start" | "end"; dimmed: boolean }) {
  const pieceColor = cn(
    "transition-colors duration-150 ease-out",
    dimmed ? "bg-gray-200" : "bg-gray-600"
  )
  const line = (
    <span
      className={cn(
        "h-[length:var(--stroke-lg)] w-7",
        side === "start" ? "-ml-dist-md" : "-mr-dist-md",
        pieceColor
      )}
    />
  )
  const dot = (
    <span className={cn("size-2.5 shrink-0 rounded-full", pieceColor)} />
  )
  return (
    <span aria-hidden className="flex items-center">
      {side === "start" ? line : dot}
      {side === "start" ? dot : line}
    </span>
  )
}

// The big −/count/+ control from the "Generate (Number based)" export. Max
// is 31 — a full month of dailies — overriding the UX doc §8.2's older 1–20
// range, per direct feedback.
export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 31,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center px-pad-sm">
      <StepButton
        label="Fewer posts"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
      >
        <Minus className="size-6" weight="bold" />
      </StepButton>
      <Connector side="start" dimmed={value <= min} />
      {/* Exactly two widths — 1ch for a single digit, 2ch for double (ch =
          one tabular digit) — so the buttons sit still at every count and
          only glide once, at the 9↔10 crossing, via the width transition
          (the segmented control's morph curve). NumberFlow's own
          per-number intrinsic width animation was tried here and rejected:
          the buttons drifted on every step. The height is pinned to the
          type token's line-height because NumberFlow's roll mask pads
          ~0.25em above and below and would grow the row. NumberFlow also
          handles the digit roll's accessibility (it exposes a spelled-out
          label and respects prefers-reduced-motion). */}
      <span
        className={cn(
          "flex h-[length:var(--text-display-lg--line-height)] items-center justify-center text-display-lg tabular-nums text-text-bold transition-[width] duration-200 ease-[cubic-bezier(0.77,0,0.175,1)]",
          value < 10 ? "w-[1ch]" : "w-[2ch]"
        )}
      >
        <NumberFlow value={value} />
      </span>
      <Connector side="end" dimmed={value >= max} />
      <StepButton
        label="More posts"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
      >
        <Plus className="size-6" weight="bold" />
      </StepButton>
    </div>
  )
}
