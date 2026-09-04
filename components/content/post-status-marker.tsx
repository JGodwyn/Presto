"use client"

import * as React from "react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { getClock, getServerClock, subscribeToClock } from "@/lib/clock"
import { hasFailed, isOverdue } from "@/lib/content-grouping"
import {
  publishFailedLabel,
  publishFailureMessage,
} from "@/lib/publish-failure"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"

// Figma "Overdue chip design" (design-sync/overdue-chip-design) — rad-md, as
// px for the squircle path math.
const CHIP_CORNER_RADIUS = 8

// The two things that can be wrong with a queued post, said on the card.
//
// Neither is a tab of its own — the Content page has three, and both of these
// are still *queued* — but until now they were invisible: a post whose date
// slid past looked exactly like one due next Tuesday, and one LinkedIn refused
// looked exactly like one nothing had tried yet. `isOverdue` and `hasFailed`
// (lib/content-grouping.ts) have existed with tests since the publishing schema
// landed; this is the first thing to render them.
//
// **Failed outranks overdue**, and they are never both shown. A post that
// failed is also, by definition, past its moment — but "we tried and LinkedIn
// said no" is the fact that explains the other one, and the one with something
// to do about it.
//
// **Only the overdue half needs a clock**, and it gets one from lib/clock.ts
// rather than a `now` prop: the Content page deliberately stopped threading a
// timestamp down when tab membership stopped depending on the clock, and
// re-introducing it would bring back the purity exception it dropped. The
// server snapshot is 0, so nothing is overdue during the server render and this
// resolves on hydration. `hasFailed` needs no clock at all and renders on both.
//
// The shape comes from the "Overdue chip design" export: a warning-tinted chip
// in a different palette to components/ui/chip.tsx but the same family. The
// export draws no icon, which is why the ClockCountdown/WarningDiamond pair
// this used to carry is gone — the tint and the word do the work.
//
// **It is deliberately quieter than the export**, per direct feedback that the
// chip was too prominent: 24px tall instead of 28, and no stroke at all. Both
// changes exist to stop it out-weighing the topic chips it shares a row with —
// a real Chip is 28px with a border, so matching that made a *warning* look
// like the most substantial thing on the card. Shorter and border-free, it
// reads as a tag on the row rather than a peer of it. The height is set
// outright rather than derived from padding: `body-md`'s line-height is 20px,
// so `py-pad-xs` would put it straight back at 28 — `items-center` splits the
// remaining 4px instead.
//
// Only the overdue half is exported. The failed half is the same chip in the
// app's danger tones: the two occupy the same slot and mean the same kind of
// thing, so they read as a pair rather than as two unrelated treatments.
export function PostStatusMarker({
  post,
  withReason = false,
  className,
}: {
  post: Post
  // Appends *why* it failed, for the one surface with room for a sentence and
  // where the fix lives (the post's own page). A card gets the two-word label:
  // there, the distinction that matters is only "this didn't go out".
  withReason?: boolean
  className?: string
}) {
  const now = React.useSyncExternalStore(
    subscribeToClock,
    getClock,
    getServerClock
  )
  const { ref, style } = useSquircleClipPath<HTMLSpanElement>({
    cornerRadius: CHIP_CORNER_RADIUS,
  })

  const failed = hasFailed(post)
  const overdue = !failed && isOverdue(post, now)

  if (!failed && !overdue) return null

  const reason = withReason && failed ? publishFailureMessage(post.publishError) : null

  const chip = (
    <span
      ref={ref}
      style={style}
      className={cn(
        "flex h-6 shrink-0 items-center rounded-rad-md px-pad-sm text-body-md-bold",
        failed
          ? "bg-surface-danger-light text-text-danger"
          : "bg-surface-warning-light text-text-warning",
        // Only the bare chip carries the caller's own layout classes; with a
        // reason those belong to the wrapper below, which is the thing sitting
        // in the row.
        reason ? undefined : className
      )}
    >
      {failed ? publishFailedLabel(post.publishError) : "Overdue"}
    </span>
  )

  if (!reason) return chip

  // A chip can't hold a sentence — it would stretch into a banner and stop
  // reading as a chip at all. The reason sits beside it as ordinary text and
  // wraps on its own, with the pair taking a full row of its own rather than
  // squeezing whatever shares the line.
  return (
    <span
      className={cn(
        "flex basis-full items-center gap-dist-sm text-body-md text-text-danger",
        className
      )}
    >
      {chip}
      <span className="min-w-0">{reason}</span>
    </span>
  )
}
