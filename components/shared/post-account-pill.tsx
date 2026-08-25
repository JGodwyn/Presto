"use client"

import * as React from "react"

import { PostAccountIcon } from "@/components/shared/post-account-icon"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import type { PostAccount, PostAccountTarget } from "@/lib/post-account"
import { cn } from "@/lib/utils"

// Figma --rad-md as px for the squircle path math.
const PILL_CORNER_RADIUS = 8

// The pill naming the account a post goes out as — the same shape in the
// Generate grid, a day deck's card, a Kanban card and the post-details header
// (design-sync/contentpagenew's own "Godwin John" pill is this exact box:
// surface-3, border-subtle at stroke-lg, rad-md, pad-xs/pad-sm, dist-sm gap).
//
// It renders as a **button only when there is somewhere to tap to**. With no
// connected accounts "Try out" is the only position the post could be in, so
// `nextAccount` is null and this becomes a plain span — no cursor, no hover
// tint, not a tab stop. A control that visibly invites a tap and does nothing
// is worse than no control.
export function PostAccountPill({
  account,
  nextAccount,
  onSelect,
  className,
}: {
  account: PostAccount
  nextAccount: PostAccountTarget | null
  onSelect?: (target: PostAccountTarget) => void
  className?: string
}) {
  // HTMLElement, not HTMLButtonElement: this is a span in the static case.
  const { ref, style } = useSquircleClipPath<HTMLElement>({
    cornerRadius: PILL_CORNER_RADIUS,
  })

  const shared = cn(
    "flex h-7 w-fit items-center gap-dist-sm rounded-rad-md border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 px-pad-sm",
    className
  )
  const content = (
    <>
      <PostAccountIcon account={account} />
      <span className="truncate text-body-md-bold text-text-bold">
        {account.label}
      </span>
    </>
  )

  if (!nextAccount || !onSelect) {
    return (
      <span ref={ref as React.Ref<HTMLSpanElement>} style={style} className={shared}>
        {content}
      </span>
    )
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      style={style}
      type="button"
      onClick={() => onSelect(nextAccount)}
      aria-label={`Change social account (currently ${account.label})`}
      className={cn(
        shared,
        // SelectPill's own capsule hover recipe — this is the same kind of
        // "click to change" control. 150ms press scale per the animation
        // standards' button rule.
        "cursor-pointer transition-[background-color,scale] duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
      )}
    >
      {content}
    </button>
  )
}
