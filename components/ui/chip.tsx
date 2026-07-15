"use client"

import * as React from "react"
import { X } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma "Chip" (design-sync/chip) radii as px for the squircle path math —
// rad-md for the chip body, rad-sm for the remove button inside it.
const CHIP_CORNER_RADIUS = 8
const REMOVE_CORNER_RADIUS = 4

// Size=md → 28px tall, body-md label; Size=lg → 32px, body-lg. Fixed heights
// rather than padding-derived ones so the CSS border (inside stroke in Figma)
// doesn't add to the box.
const sizeClasses = {
  md: "h-7 text-body-md",
  lg: "h-8 text-body-lg",
} as const

interface ChipProps extends React.ComponentProps<"span"> {
  size?: keyof typeof sizeClasses
  selected?: boolean
  onRemove?: () => void
}

// Selected chips are the solid gray pill with the boxed X; unselected ones
// are the flat surface-3 outline with no remove affordance, per the export.
function Chip({
  size = "lg",
  selected = true,
  onRemove,
  className,
  children,
  ...props
}: ChipProps) {
  const { ref: chipRef, style: chipStyle } =
    useSquircleClipPath<HTMLSpanElement>({
      cornerRadius: CHIP_CORNER_RADIUS,
    })
  const { ref: removeRef, style: removeStyle } =
    useSquircleClipPath<HTMLButtonElement>({
      cornerRadius: REMOVE_CORNER_RADIUS,
    })

  return (
    <span
      ref={chipRef}
      style={chipStyle}
      className={cn(
        "flex max-w-full items-center gap-dist-md rounded-rad-md border-[length:var(--stroke-lg)] px-pad-sm py-pad-xs",
        selected
          ? "border-gray-600 bg-gray-400 text-text-inverse"
          : "border-border-subtle bg-surface-3 text-text-subtle",
        sizeClasses[size]
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      {selected && onRemove ? (
        <button
          ref={removeRef}
          style={removeStyle}
          type="button"
          aria-label={`Remove ${typeof children === "string" ? children : "chip"}`}
          onClick={onRemove}
          className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-rad-sm bg-gray-600 text-text-inverse outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-2" weight="bold" />
        </button>
      ) : null}
    </span>
  )
}

export { Chip }
