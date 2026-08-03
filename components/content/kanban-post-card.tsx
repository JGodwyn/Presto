"use client"

import Link from "next/link"

import {
  SOCIAL_PLATFORM_OPTIONS,
  type SocialPlatform,
} from "@/components/generate/social-platform-options"
import { Chip } from "@/components/ui/chip"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"

// Figma --rad-lg / --rad-md as px for the squircle path math.
const CARD_CORNER_RADIUS = 16
const PILL_CORNER_RADIUS = 8

// How far the pill/topics row dissolves at each end once it has more to
// scroll to — small, since the row itself is only 28px tall.
const ROW_FADE_PX = 16

// The compact post card that stacks inside a Kanban column
// (design-sync/content-kanban-view). Visually a cut-down GeneratedPostCard —
// same surface, radius and padding, same platform pill and topic chips — but
// deliberately its own component rather than a variant of that one: it shares
// no behaviour with it at all (no inline editing, no date picker, no
// regenerate, no actions menu), and the whole card is a single control here.
//
// Where that card carries a border, this one doesn't: it sits on the column's
// own surface-3 tray, which is what separates it from its neighbours.
export function KanbanPostCard({
  post,
  href,
}: {
  post: Post
  // This post's own page.
  href: string
}) {
  const { ref, style } = useSquircleClipPath<HTMLAnchorElement>({
    cornerRadius: CARD_CORNER_RADIUS,
  })
  const { ref: pillRef, style: pillStyle } =
    useSquircleClipPath<HTMLSpanElement>({ cornerRadius: PILL_CORNER_RADIUS })
  const { ref: topicsRef, onScroll: onTopicsScroll } = useScrollFade({
    axis: "x",
    start: ROW_FADE_PX,
    end: ROW_FADE_PX,
  })

  const platform: SocialPlatform = post.platform
  const social =
    SOCIAL_PLATFORM_OPTIONS.find((option) => option.value === platform) ??
    SOCIAL_PLATFORM_OPTIONS[0]

  return (
    <Link
      ref={ref}
      style={style}
      href={href}
      // A link, not a button: it goes to the post's own page, so it should
      // behave like one (cmd-click, middle-click, the status bar). The 150ms
      // press scale is the animation standards' button rule; a drag across the
      // board still can't trigger it, since the drag hook takes pointer
      // capture past its 4px threshold and the click never lands.
      className="flex w-full shrink-0 cursor-pointer flex-col gap-dist-md rounded-rad-lg bg-surface-4 p-pad-lg text-left transition-[scale] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
    >
      {/* Two lines, then an ellipsis — the export's own 48px/2-line box. */}
      <span className="line-clamp-2 text-body-lg text-text-bold">
        {post.content}
      </span>

      {/* Same row shape as the full card: the platform pill, then the topics.
          Both are display-only here, so the pill is a span rather than the
          tap-to-cycle button it is there.

          Scrolls rather than clipping, so a long topic list is reachable
          instead of cut off mid-chip, with the fade dissolving whatever runs
          past either end. Its own pointer handling stops here: this row sits
          inside a card that is itself a button inside a drag-scrolled board,
          and a horizontal drag over it should scroll the row, not the row and
          the board together. */}
      <span
        ref={topicsRef}
        onScroll={onTopicsScroll}
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          "flex items-center gap-dist-md overflow-x-auto",
          HIDE_NATIVE_SCROLLBAR_CLASSNAME
        )}
      >
        <span
          ref={pillRef}
          style={pillStyle}
          className="flex h-7 shrink-0 items-center gap-dist-sm rounded-rad-md border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 px-pad-sm"
        >
          {social.icon}
          <span className="text-body-md-bold text-text-bold">
            {social.label}
          </span>
        </span>
        {post.topics.map((topic) => (
          <Chip key={topic} size="md" selected={false} className="shrink-0">
            {topic}
          </Chip>
        ))}
      </span>
    </Link>
  )
}
