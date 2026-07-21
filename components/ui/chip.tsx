"use client"

import * as React from "react"
import { X } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma "Chip" (design-sync/chip) radii as px for the squircle path math —
// rad-md for the chip body, rad-sm for the X icon's own boxed background.
const CHIP_CORNER_RADIUS = 8
const REMOVE_ICON_CORNER_RADIUS = 4

// Size=md → 28px tall, body-md label; Size=lg → 32px, body-lg. Fixed heights
// rather than padding-derived ones so the CSS border (inside stroke in Figma)
// doesn't add to the box.
const sizeClasses = {
  md: "h-7 text-body-md",
  lg: "h-8 text-body-lg",
} as const

interface ChipProps {
  size?: keyof typeof sizeClasses
  selected?: boolean
  onRemove?: () => void
  className?: string
  children?: React.ReactNode
  title?: string
}

// Selected chips are the solid gray pill with the boxed X; unselected ones
// are the flat surface-3 outline with no remove affordance, per the export.
// When removable, the whole chip is the tap target — not just the small X —
// per direct feedback that the X alone was an easy miss. It renders as a
// single <button> rather than a <span> wrapping a nested <button> (which
// the X used to be): a button can't nest inside another interactive
// element, and a bigger hit target was the whole point of the change. The X
// stays visually identical, just as a plain decorative span now.
function Chip({
  size = "lg",
  selected = true,
  onRemove,
  className,
  children,
  title,
}: ChipProps) {
  const { ref: chipRef, style: chipStyle } = useSquircleClipPath<HTMLElement>(
    { cornerRadius: CHIP_CORNER_RADIUS }
  )
  const { ref: removeIconRef, style: removeIconStyle } =
    useSquircleClipPath<HTMLSpanElement>({
      cornerRadius: REMOVE_ICON_CORNER_RADIUS,
    })

  const sharedClassName = cn(
    "flex max-w-full items-center gap-dist-md rounded-rad-md border-[length:var(--stroke-lg)] px-pad-sm py-pad-xs",
    selected
      ? "border-gray-600 bg-gray-400 text-text-inverse"
      : "border-border-subtle bg-surface-3 text-text-subtle",
    sizeClasses[size]
  )
  const label = <span className="truncate">{children}</span>

  if (selected && onRemove) {
    return (
      <button
        ref={chipRef as React.Ref<HTMLButtonElement>}
        style={chipStyle}
        type="button"
        title={title}
        aria-label={`Remove ${typeof children === "string" ? children : "chip"}`}
        onClick={onRemove}
        className={cn(
          sharedClassName,
          // Button press feedback per the review-animations standards —
          // this element wasn't independently pressable before.
          "cursor-pointer transition-transform duration-150 ease-out outline-none active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        {label}
        <span
          ref={removeIconRef}
          style={removeIconStyle}
          className="flex size-4 shrink-0 items-center justify-center rounded-rad-sm bg-gray-600 text-text-inverse"
        >
          <X className="size-2" weight="bold" />
        </span>
      </button>
    )
  }

  return (
    <span
      ref={chipRef as React.Ref<HTMLSpanElement>}
      style={chipStyle}
      title={title}
      className={cn(sharedClassName, className)}
    >
      {label}
    </span>
  )
}

export { Chip }
