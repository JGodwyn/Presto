"use client"

import { DayChip } from "@/components/content/day-chip"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"
import type { MonthGroup } from "@/lib/content-grouping"

// Figma --rad-lg as px for the squircle path math.
const SECTION_CORNER_RADIUS = 16

// One month's worth of day chips: a Phudu month/year heading over a surface-3
// tray. It wraps on desktop and becomes a drag-scrollable rail on mobile, as
// the supplied mobile Content export shows. The tray carries no border despite
// the frame having stroke-weight tokens set on it.
export function MonthSection({
  month,
  onOpenDay,
}: {
  month: MonthGroup
  onOpenDay: (dayKey: string, element: HTMLButtonElement) => void
}) {
  const dragScroll = useDragScroll()
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
        onPointerDown={dragScroll.onPointerDown}
        onPointerMove={dragScroll.onPointerMove}
        onPointerUp={dragScroll.onPointerUp}
        onPointerCancel={dragScroll.onPointerCancel}
        className={cn(
          "flex flex-nowrap gap-dist-sm overflow-x-auto rounded-rad-lg bg-surface-3 p-pad-md md:flex-wrap md:p-pad-lg",
          dragScroll.isDragging && "cursor-grabbing select-none",
          HIDE_NATIVE_SCROLLBAR_CLASSNAME
        )}
      >
        <div
          style={{
            transform: `translateX(${dragScroll.elasticOffset}px)`,
            transition: dragScroll.isDragging
              ? "none"
              : "transform 200ms cubic-bezier(0.77, 0, 0.175, 1)",
          }}
          className="flex w-max gap-dist-sm md:w-auto md:contents"
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
      </div>
    </section>
  )
}
