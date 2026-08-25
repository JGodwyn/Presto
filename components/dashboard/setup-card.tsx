"use client"

import Link from "next/link"
import { CaretRight, Checks, QuestionMark, Warning } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { DashboardCardTitle } from "@/components/dashboard/dashboard-card"

// --rad-xmd, shared by the tray, each tile and each pill.
const CORNER_RADIUS = 12

export type SetupState = "done" | "todo" | "warning"

export interface SetupRow {
  label: string
  detail: string
  state: SetupState
  href: string
}

// Three treatments from the export, each colouring its badge, its pill and the
// caret together. `todo` is the quiet one — an outlined badge on white and a
// plain surface-3 pill — because "you haven't done this yet" is not a fault.
const STATE = {
  done: {
    Icon: Checks,
    badge: "bg-surface-success-light",
    icon: "text-icon-success",
    pill: "bg-surface-success-light",
    caret: "text-icon-success",
  },
  warning: {
    Icon: Warning,
    badge: "bg-surface-warning-light",
    icon: "text-icon-warning",
    pill: "bg-surface-warning-light",
    caret: "text-icon-warning",
  },
  todo: {
    Icon: QuestionMark,
    badge: "border-[length:var(--stroke-md)] border-border-bold bg-surface-4",
    icon: "text-icon-subtle",
    pill: "bg-surface-3",
    caret: "text-icon-subtle",
  },
} as const

// One tile: badge, label, then the pill carrying the figure and the caret.
function SetupTile({ row }: { row: SetupRow }) {
  const tone = STATE[row.state]
  const { ref: tileRef, style: tileStyle } = useSquircleClipPath<HTMLAnchorElement>({
    cornerRadius: CORNER_RADIUS,
  })
  const { ref: pillRef, style: pillStyle } = useSquircleClipPath<HTMLSpanElement>({
    cornerRadius: CORNER_RADIUS,
  })

  return (
    <Link
      ref={tileRef}
      style={tileStyle}
      href={row.href}
      // 150ms press feedback per the animation standards' button rule; the
      // hover tint is the same color-mix recipe DayChip and SelectPill use.
      className="flex flex-col gap-dist-md rounded-rad-xmd bg-surface-4 px-pad-md py-pad-sm transition-[background-color,scale] duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-4),var(--foreground)_4%)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]"
    >
      <span
        className={cn(
          // rounded-full, not rounded-rad-rd — see total-posts-card.tsx and
          // LEARNINGS: that class generates nothing.
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          tone.badge
        )}
      >
        <tone.Icon weight="bold" className={cn("size-4", tone.icon)} />
      </span>

      <span className="text-body-lg text-text-bold">{row.label}</span>

      {/* mt-auto pins the pills to a common baseline across a row. Grid
          stretches every tile to the tallest in its row, and a label that
          wraps to two lines would otherwise push its own pill down out of
          line with its neighbours'. */}
      <span
        ref={pillRef}
        style={pillStyle}
        className={cn(
          "mt-auto flex w-fit items-center gap-dist-xs rounded-rad-xmd py-pad-2xs pr-pad-xs pl-pad-sm",
          tone.pill
        )}
      >
        <span className="text-body-lg text-text-bold">{row.detail}</span>
        <CaretRight weight="bold" className={cn("size-4 shrink-0", tone.caret)} />
      </span>
    </Link>
  )
}

// How ready this project is to produce good posts. Every tile is derived from
// data the app already stores, and every tile links to the page that fixes it —
// which is the half of this page that stays useful on day one, before there
// are any posts to count.
//
// From the "DashboardSetup" export: a 3x2 grid of white tiles sitting straight
// on the page canvas. Same six fields, same tones. The export's header is just
// the title, so the "n of 6" counter an earlier version carried is gone with
// it.
export function SetupCard({
  rows,
  className,
}: {
  rows: SetupRow[]
  className?: string
}) {
  return (
    // Deliberately *not* a DashboardCard, unlike every other block on this
    // page: the stripped-down export gives this section the canvas colour and
    // no padding of its own, so the white tiles are the only card-like thing
    // in it. That's also why the tiles carry no border — nothing but the
    // surface change separates them from the page.
    <section className={cn("flex flex-col gap-dist-md", className)}>
      <DashboardCardTitle>Setup</DashboardCardTitle>

      <div className="grid grid-cols-3 gap-dist-md">
        {rows.map((row) => (
          <SetupTile key={row.label} row={row} />
        ))}
      </div>
    </section>
  )
}
