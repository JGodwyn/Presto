"use client"

import Link from "next/link"
import { CalendarDots } from "@phosphor-icons/react"

import type { Post } from "@/types/post"
import { formatRelativeDay } from "@/lib/dashboard-summary"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { SocialIcon } from "@/components/shared/social-icon"

// --rad-lg: the post cards are the one rad-lg thing on this page, a notch
// rounder than the rad-xmd cards holding them.
const CARD_CORNER_RADIUS = 16

// The export's "Post" instance: a date row with the platform mark opposite,
// then two lines of the post itself. The whole card links to the post's own
// page — the same destination the Kanban card and the day deck's "Open up"
// already use, so a post is reached the same way from everywhere.
export function DashboardPostCard({
  post,
  href,
  now,
}: {
  post: Post
  href: string
  now: Date
}) {
  const { ref, style } = useSquircleClipPath<HTMLAnchorElement>({
    cornerRadius: CARD_CORNER_RADIUS,
  })
  const date = post.scheduledFor ? new Date(post.scheduledFor) : null

  return (
    <Link
      ref={ref}
      style={style}
      href={href}
      // 150ms press feedback per the animation standards' button rule; the
      // hover tint is the same color-mix recipe DayChip and SelectPill use.
      className="flex flex-col gap-dist-md rounded-rad-lg bg-surface-4 p-pad-lg transition-[background-color,scale] duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-4),var(--foreground)_4%)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99]"
    >
      <span className="flex items-center justify-between gap-dist-md">
        <span className="flex min-w-0 items-center gap-dist-md">
          <span className="flex min-w-0 items-center gap-dist-sm">
            <CalendarDots weight="bold" className="size-5 shrink-0 text-icon-subtle" />
            <span className="truncate text-body-lg-bold text-text-bold">
              {date
                ? date.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "No date"}
            </span>
          </span>
          {date ? (
            <>
              <span className="text-body-lg-bold text-text-subtle">•</span>
              <span className="shrink-0 text-body-lg-bold text-text-subtle">
                {formatRelativeDay(date, now)}
              </span>
            </>
          ) : null}
        </span>

        <SocialIcon platform={post.platform} className="size-6 shrink-0" />
      </span>

      {/* Two lines then an ellipsis, as the export draws it — this is a
          reminder of which post it is, not a preview of it. */}
      <span className="line-clamp-2 text-body-lg text-text-bold">
        {post.content}
      </span>
    </Link>
  )
}
