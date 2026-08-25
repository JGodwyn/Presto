"use client"

import { KanbanColumn } from "@/components/content/kanban-column"
import type { ConnectedSocialAccount } from "@/types/social-account"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import type { MonthGroup } from "@/lib/content-grouping"
import type { Post } from "@/types/post"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"

// The elastic overshoot springing back after a drag — same pair the day deck
// uses (hooks/use-drag-scroll.ts).
const ELASTIC_SETTLE_MS = 200
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)"

// Taller than the export's 256px, by request — three cards fit in a column
// now instead of two.
const BOARD_HEIGHT_CLASSNAME = "h-100"

// Below this many posts in a month's busiest day, the board hugs its content
// instead: a row of one- and two-card columns shouldn't leave a band of empty
// tray under every one of them just to reserve room for a third. At three the
// fixed height takes over and the columns that exceed it scroll.
const HUG_CONTENT_MAX_POSTS = 2

// How far a column dissolves as it scrolls past either end of the row.
const EDGE_FADE_PX = 24

// The Kanban twin of MonthSection: the same Phudu month heading, but a row of
// day columns instead of chips (design-sync/content-kanban-view). The row is a
// fixed height with every column filling it, per the export — a month with
// more days than fit scrolls sideways, by wheel or by drag, the same gesture
// the day deck and the skip-dates carousel use.
export function MonthBoard({
  month,
  accounts,
  activeTopics,
  postHref,
}: {
  month: MonthGroup
  accounts: ConnectedSocialAccount[]
  activeTopics: Set<string>
  postHref: (post: Post) => string
}) {
  const dragScroll = useDragScroll()
  const { ref: rowRef, onScroll: onRowScroll } = useScrollFade({
    axis: "x",
    start: EDGE_FADE_PX,
    end: EDGE_FADE_PX,
  })
  // "July 2026" → "July": the columns' own headers read "8th July", so they
  // need the month on its own.
  const monthLabel = month.label.split(" ")[0]

  // The busiest day decides for the whole month: columns in a row all share
  // the tallest one's height (flex stretch), so this can't be a per-column
  // call. Left unset, the row is auto-height and the columns hug — which is
  // also why the height classes below are the only thing that changes: `h-full`
  // on a column inside an auto-height row simply resolves to auto.
  const tallestColumn = Math.max(...month.days.map((day) => day.posts.length))
  const hugContent = tallestColumn <= HUG_CONTENT_MAX_POSTS

  return (
    <section className="flex w-full flex-col gap-dist-md">
      {/* font-display (Phudu) renders caps on its own — no `uppercase`. */}
      <h2 className="text-title-lg font-display text-text-bold">{month.label}</h2>

      <div
        ref={rowRef}
        onScroll={onRowScroll}
        onPointerDown={dragScroll.onPointerDown}
        onPointerMove={dragScroll.onPointerMove}
        onPointerUp={dragScroll.onPointerUp}
        onPointerCancel={dragScroll.onPointerCancel}
        className={cn(
          !hugContent && BOARD_HEIGHT_CLASSNAME,
          "w-full overflow-x-auto overscroll-x-contain",
          dragScroll.isDragging && "cursor-grabbing select-none",
          HIDE_NATIVE_SCROLLBAR_CLASSNAME
        )}
      >
        <div
          style={{
            transform: `translateX(${dragScroll.elasticOffset}px)`,
            // No transition while actively dragging — the offset has to track
            // the pointer 1:1. Only the release springs back.
            transition: dragScroll.isDragging
              ? "none"
              : `transform ${ELASTIC_SETTLE_MS}ms ${EASE_IN_OUT}`,
          }}
          className="h-full"
        >
          <div className="flex h-full w-max gap-dist-sm">
            {month.days.map((day) => (
              <KanbanColumn
                key={day.key}
                day={day}
                monthLabel={monthLabel}
                accounts={accounts}
                activeTopics={activeTopics}
                postHref={postHref}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
