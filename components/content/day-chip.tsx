"use client"

import { CalendarDots } from "@phosphor-icons/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { formatOrdinal } from "@/lib/format-date"

// Figma --rad-xmd as px for the squircle path math.
const CHIP_CORNER_RADIUS = 12

// One day that has posts, from the Figma "Content / Base calendar view"
// export: a fixed 88px card, day number over the count. Clicking it opens
// that day's deck (design-sync/content-day-clicked) — and hands its own
// on-screen box up with the click, since every card in the deck flies out of
// exactly this rectangle.
export function DayChip({
  day,
  postCount,
  onOpen,
}: {
  day: number
  postCount: number
  onOpen: (element: HTMLButtonElement) => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: CHIP_CORNER_RADIUS,
  })

  return (
    <button
      ref={ref}
      style={style}
      type="button"
      onClick={(event) => onOpen(event.currentTarget)}
      // min-w-22 rather than the export's fixed 88px: every chip it draws
      // holds a single-digit count, which fits — a real "23 posts" doesn't,
      // and wrapped onto two lines inside a fixed width. Hugging from 88px up
      // keeps every case the export actually shows pixel-identical.
      //
      // 150ms press feedback per the animation standards' button rule; the
      // hover tint is the same recipe the social pill and SelectPill use.
      className="flex min-w-22 cursor-pointer flex-col items-center rounded-rad-xmd border-[length:var(--stroke-lg)] border-border-subtle bg-surface-4 px-pad-md py-pad-sm whitespace-nowrap transition-[background-color,scale] duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-4),var(--foreground)_4%)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
    >
      <span className="flex items-center gap-dist-xs text-body-md-bold text-text-subtle">
        <CalendarDots weight="bold" className="size-4 text-icon-minimal" />
        {formatOrdinal(day)}
      </span>
      <span className="text-body-lg-bold text-text-bold">
        {postCount} {postCount === 1 ? "post" : "posts"}
      </span>
    </button>
  )
}
