"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"
import { setContentTab } from "@/lib/content-view"
import { formatDate } from "@/lib/format-date"
import type { MonthSummary } from "@/lib/dashboard-summary"
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/dashboard/dashboard-card"

// Sunday-first, as components/ui/calendar.tsx's own week is.
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

// The month grid from the export, matching the Figma `_calendar-item`
// component's states rather than the density ramp the earlier mockup used:
//
//   has content     → Date/Calendar-item/surface-selected (purple), inverse text
//   in month, empty → surface-hover (the canvas grey), bold text
//   today           → a stroke-xl border-brand ring *on top of* whichever fill
//                     the day already earns: purple when it has posts (per
//                     direct request — being today shouldn't hide the fact
//                     that something is scheduled), surface-rest (white)
//                     when it doesn't
//   adjacent month  → no fill, minimal text
//
// The frame.json disagrees with its own screenshot on the first row (it marks
// the 5th and 6th surface-rest/text-minimal, where the picture plainly shows
// them grey like every other empty in-month day). The screenshot wins, per the
// figma-bridge workflow.
function DayCell({
  day,
  state,
  isToday = false,
  label,
  href,
  onSelect,
}: {
  day: number
  // What the day *is* — the fill it earns. Today is a separate flag rather
  // than a fourth value here, because it's a ring drawn over one of these
  // rather than a state of its own.
  state: "content" | "empty" | "adjacent"
  isToday?: boolean
  label?: string
  // Set only for a day that actually has posts — those link through to
  // Content; an empty day has nothing to show, so it stays inert rather than
  // dumping you on the page with no idea why.
  href?: string
  onSelect?: (event: React.MouseEvent) => void
}) {
  const className = cn(
    // Plain rounded-rad-md, no squircle clip-path: components/ui/calendar.tsx
    // makes the same call for its own day cells, and 42 ResizeObservers to
    // smooth an 8px corner is not a trade worth making.
    "flex h-10 items-center justify-center rounded-rad-md text-body-lg",
    state === "content" && "bg-date-calendar-item-surface-selected text-text-inverse",
    // Today with nothing on it takes surface-rest (white) rather than the grey
    // every other empty day gets — the ring needs something to sit against.
    state === "empty" &&
      (isToday
        ? "bg-date-calendar-item-surface-rest text-text-bold"
        : "bg-date-calendar-item-surface-hover text-text-bold"),
    state === "adjacent" && "text-text-minimal",
    isToday && "border-[length:var(--stroke-xl)] border-border-brand",
    // 150ms press feedback per the animation standards' button rule; the hover
    // tint is the same color-mix recipe DayChip and SelectPill use, which
    // works over any of the cell fills above rather than needing one per state.
    href &&
      "cursor-pointer transition-[background-color,scale] duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--color-date-calendar-item-surface-selected),var(--foreground)_12%)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.94]"
  )

  if (!href) {
    return (
      <span title={label} className={className}>
        {day}
      </span>
    )
  }

  return (
    <Link href={href} title={label} aria-label={label} onClick={onSelect} className={className}>
      {day}
    </Link>
  )
}

export function MonthCalendarCard({
  summary,
  projectId,
  contentHref,
  postBase,
  postIdsByDay,
  className,
}: {
  summary: MonthSummary
  projectId: string
  contentHref: string
  postBase: string
  // Post ids for each day of this month, keyed by day-of-month.
  postIdsByDay: Map<number, string[]>
  className?: string
}) {
  const firstWeekday = new Date(summary.year, summary.month, 1).getDay()
  // Days of the previous month that fill the first row, so it starts on a
  // Sunday like the export's does.
  const leadIn = new Date(summary.year, summary.month, 0).getDate()
  const emptyRemaining = summary.daysRemaining - summary.remainingDaysCovered

  // Content has no route for a single day — its deck opens from a chip on the
  // page itself — so the closest honest destination is the Content page with
  // the right *tab* already selected. That tab is a stored preference
  // (lib/content-view.ts), so setting it here is all it takes; the page reads
  // it through useSyncExternalStore on arrival. A day with anything still to
  // come is Queued, otherwise everything on it has gone out and it's
  // Published.
  //
  // Deliberately not deep-linking to the day itself: that would mean teaching
  // components/content/content-view.tsx to open a deck from a URL, and that
  // file belongs to another in-flight branch.
  const selectDay = (day: number) => {
    setContentTab(
      projectId,
      summary.upcomingByDay[day - 1] > 0 ? "queued" : "published"
    )
  }

  // Built with Array.from rather than a mutating `for` loop: each cell's click
  // handler closes over its own day, and the React Compiler rejects capturing
  // a loop variable that the loop then reassigns.
  const leadCells = Array.from({ length: firstWeekday }, (_, index) => (
    <DayCell
      key={`lead-${index}`}
      day={leadIn - firstWeekday + 1 + index}
      state="adjacent"
    />
  ))

  const monthCells = Array.from({ length: summary.daysInMonth }, (_, index) => {
    const day = index + 1
    const count = summary.countsByDay[day - 1]
    const label = `${formatDate(new Date(summary.year, summary.month, day))} — ${count} ${count === 1 ? "post" : "posts"}`
    const hasContent = count > 0
    const ids = postIdsByDay.get(day) ?? []
    // One post on the day: go straight to it, exactly as a Next-up card does.
    // Several: there's nothing to disambiguate between, so fall back to
    // Content with this day's tab selected. Setting the tab only matters on
    // that second path — a post's own page has no tabs.
    const single = ids.length === 1
    return (
      <DayCell
        key={day}
        day={day}
        state={hasContent ? "content" : "empty"}
        isToday={summary.today === day}
        label={label}
        href={
          !hasContent ? undefined : single ? `${postBase}/${ids[0]}` : contentHref
        }
        onSelect={hasContent && !single ? () => selectDay(day) : undefined}
      />
    )
  })

  // Fill the last row out to a full week, same as the export's trailing 1-6.
  const trailingCount =
    (7 - ((leadCells.length + monthCells.length) % 7)) % 7
  const trailCells = Array.from({ length: trailingCount }, (_, index) => (
    <DayCell key={`trail-${index}`} day={index + 1} state="adjacent" />
  ))

  const cells = [...leadCells, ...monthCells, ...trailCells]

  return (
    <DashboardCard className={cn("gap-dist-lg", className)}>
      <DashboardCardTitle>{summary.label}</DashboardCardTitle>

      <div className="flex flex-col gap-dist-sm">
        <div className="grid grid-cols-7 gap-dist-sm">
          {WEEKDAYS.map((label, index) => (
            <span
              key={index}
              className="flex h-8 items-center justify-center text-body-lg text-text-subtle"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-dist-sm">{cells}</div>
      </div>

      <div className="flex flex-col gap-dist-2xs rounded-rad-xmd bg-surface-3 px-pad-md py-pad-sm">
        <span className="text-body-lg text-text-bold">
          {summary.daysCovered} of {summary.daysInMonth} days with content
        </span>
        <span className="text-body-md text-text-subtle">
          {summary.today === null
            ? `${summary.scheduled} scheduled this month`
            : emptyRemaining === 0
              ? "Every remaining day is covered"
              : `${emptyRemaining} of your ${summary.daysRemaining} remaining ${summary.daysRemaining === 1 ? "day has" : "days have"} nothing scheduled`}
        </span>
      </div>
    </DashboardCard>
  )
}
