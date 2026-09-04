"use client"

import * as React from "react"
import { ClockCountdown, WarningDiamond } from "@phosphor-icons/react"

import { getClock, getServerClock, subscribeToClock } from "@/lib/clock"
import { hasFailed, isOverdue } from "@/lib/content-grouping"
import {
  publishFailedLabel,
  publishFailureMessage,
} from "@/lib/publish-failure"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"

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
// No Figma export draws either state (the content exports predate publishing),
// so it is composed from tokens: the app's warning and danger text colours, and
// the same `body-md-bold` the card's time uses — it sits in that slot, so it
// has to match its weight.
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

  const failed = hasFailed(post)
  const overdue = !failed && isOverdue(post, now)

  if (!failed && !overdue) return null

  const Icon = failed ? WarningDiamond : ClockCountdown

  const reason = withReason && failed ? publishFailureMessage(post.publishError) : null

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-dist-sm text-body-md-bold",
        // Only hugging when it's a label. With a reason it is a sentence, and
        // has to be allowed to wrap rather than push the row wider.
        reason ? "basis-full" : "shrink-0",
        failed ? "text-text-danger" : "text-text-warning",
        className
      )}
    >
      <Icon weight="bold" className="size-4 shrink-0" />
      <span className={reason ? undefined : "shrink-0"}>
        {failed ? publishFailedLabel(post.publishError) : "Overdue"}
        {reason ? <span className="font-normal"> — {reason}</span> : null}
      </span>
    </span>
  )
}
