"use client"

import { CalendarDots } from "@phosphor-icons/react"

import { KanbanPostCard } from "@/components/content/kanban-post-card"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import type { DayGroup } from "@/lib/content-grouping"
import { formatOrdinal } from "@/lib/format-date"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import type { Post } from "@/types/post"

// Figma --rad-xmd as px for the squircle path math.
const COLUMN_CORNER_RADIUS = 12

// How far the stack dissolves at each end once there's more to scroll to.
// Bottom is deeper than top for the same reason GeneratedPostCard's content
// fade is: it's the only thing signalling there's more below, where the top
// fade only matters once you're already scrolling and know that.
const STACK_FADE_TOP_PX = 20
const STACK_FADE_BOTTOM_PX = 40

// One day's column on the Kanban board (design-sync/content-kanban-view): a
// 256px surface-3 tray, its header naming the day and counting its posts, and
// the day's posts stacked underneath.
//
// The board fixes every column to the same height, so a day with more posts
// than fit scrolls within its own stack rather than stretching the row. The
// export simply clips there — it has no way to show a scroll — but leaving
// posts unreachable isn't an option in the real thing.
export function KanbanColumn({
  day,
  monthLabel,
  postHref,
}: {
  day: DayGroup
  // "July" — the day header reads "8th July", so the column needs its month
  // even though the section heading above already names it.
  monthLabel: string
  // Where a card goes when tapped: its own page.
  postHref: (post: Post) => string
}) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: COLUMN_CORNER_RADIUS,
  })
  const { ref: stackRef, onScroll: onStackScroll } = useScrollFade({
    axis: "y",
    start: STACK_FADE_TOP_PX,
    end: STACK_FADE_BOTTOM_PX,
  })

  return (
    <div
      ref={ref}
      style={style}
      className="flex h-full w-64 shrink-0 flex-col gap-dist-md rounded-rad-xmd border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 px-pad-md py-pad-sm"
    >
      <div className="flex shrink-0 items-center justify-between">
        <span className="flex items-center gap-dist-sm text-body-lg-bold text-text-bold">
          <CalendarDots weight="bold" className="size-5 text-icon-minimal" />
          {formatOrdinal(day.day)} {monthLabel}
        </span>
        <span className="text-body-lg-bold text-text-subtle">
          {day.posts.length}
        </span>
      </div>

      <div
        ref={stackRef}
        onScroll={onStackScroll}
        className={`flex min-h-0 flex-1 flex-col gap-dist-md overflow-y-auto ${HIDE_NATIVE_SCROLLBAR_CLASSNAME}`}
      >
        {day.posts.map((post) => (
          <KanbanPostCard key={post.id} post={post} href={postHref(post)} />
        ))}
      </div>
    </div>
  )
}
