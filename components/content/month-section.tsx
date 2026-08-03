"use client"

import { DayChip } from "@/components/content/day-chip"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import type { MonthGroup } from "@/lib/content-grouping"

// Figma --rad-lg as px for the squircle path math.
const SECTION_CORNER_RADIUS = 16

// One month's worth of day chips: a Phudu month/year heading over a surface-3
// tray that wraps its chips (design-sync/content-base-calendar-view). The tray
// carries no border in the export — only a fill — despite the frame having
// stroke-weight tokens set on it.
export function MonthSection({
  month,
  onOpenDay,
}: {
  month: MonthGroup
  onOpenDay: (dayKey: string, element: HTMLButtonElement) => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: SECTION_CORNER_RADIUS,
  })

  return (
    <section className="flex w-full flex-col gap-dist-md">
      {/* font-display (Phudu) renders caps on its own — no `uppercase`. */}
      <h2 className="text-title-lg font-display text-text-bold">{month.label}</h2>
      <div
        ref={ref}
        style={style}
        className="flex flex-wrap gap-dist-sm rounded-rad-lg bg-surface-3 p-pad-lg"
      >
        {month.days.map((day) => (
          <DayChip
            key={day.key}
            day={day.day}
            postCount={day.posts.length}
            onOpen={(element) => onOpenDay(day.key, element)}
          />
        ))}
      </div>
    </section>
  )
}
