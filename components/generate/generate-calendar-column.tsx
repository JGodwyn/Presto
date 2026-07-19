"use client"

import * as React from "react"
import { Info, WarningCircle } from "@phosphor-icons/react"

import { Calendar, type DateRange } from "@/components/ui/calendar"
import { Switch } from "@/components/ui/switch"
import { MonthGrid, type MonthSelection } from "@/components/generate/month-grid"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"

// Figma --rad-lg as px for the squircle path math (the "Skip some dates"
// toggle pill).
const TOGGLE_PILL_CORNER_RADIUS = 16
// Fixed so the column never resizes as its own content changes shape (a
// single 320px calendar vs. the wider month grid vs. several skip-dates
// calendars in a row) — per direct feedback, it was previously just
// whatever width the flex row happened to hand it.
const COLUMN_WIDTH_CLASSNAME = "w-100"
// Below this many pixels of horizontal pointer movement, a pointer-down is
// still treated as a plain click (so tapping a day in a MonthSkipCalendar
// isn't swallowed by the drag-to-scroll handler below).
const DRAG_THRESHOLD_PX = 4

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getDaysInMonth(year: number, month: number): Date[] {
  const count = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1))
}

// "July 13, 2026" — same format as the number-based demo used, restored
// here as the range readout (see the note at its call site below).
function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

// Click-and-drag horizontal scrolling for the skip-dates calendar row,
// alongside the wheel/trackpad scrolling overflow-x-auto already gives for
// free. Only commits to "this is a drag" past a small movement threshold —
// until then a pointerdown+pointerup with no movement reaches the
// underlying day-cell button as an ordinary click, uninterrupted.
function useDragToScroll<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const dragRef = React.useRef<{
    startX: number
    startScrollLeft: number
    dragging: boolean
  } | null>(null)

  const onPointerDown = (event: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    dragRef.current = {
      startX: event.clientX,
      startScrollLeft: el.scrollLeft,
      dragging: false,
    }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const el = ref.current
    const drag = dragRef.current
    if (!el || !drag) return
    const dx = event.clientX - drag.startX
    if (!drag.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
      drag.dragging = true
      el.setPointerCapture(event.pointerId)
    }
    el.scrollLeft = drag.startScrollLeft - dx
  }

  const endDrag = () => {
    dragRef.current = null
  }

  return {
    ref,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  }
}

// One calendar per month selected for skipping. "Selected" here is
// inverted from Calendar's usual meaning — every day of the month starts
// selected (= will post), and clicking one moves it into `skippedDates`
// instead of adding it to some picked-dates list. Calendar itself only
// knows how to toggle membership in the array it's given, so this diffs the
// before/after array to figure out which single day flipped and updates
// `skippedDates` accordingly.
function MonthSkipCalendar({
  year,
  month,
  skippedDates,
  onToggleSkipDate,
}: {
  year: number
  month: number
  skippedDates: Date[]
  onToggleSkipDate: (date: Date, skip: boolean) => void
}) {
  const monthDays = getDaysInMonth(year, month)
  const selected = monthDays.filter(
    (day) => !skippedDates.some((skipped) => isSameDay(skipped, day))
  )

  return (
    <Calendar
      mode="multiple"
      selected={selected}
      onSelect={(next) => {
        const nowSkipped = selected.find(
          (day) => !next.some((n) => isSameDay(n, day))
        )
        const unSkipped = next.find(
          (day) => !selected.some((s) => isSameDay(s, day))
        )
        if (nowSkipped) onToggleSkipDate(nowSkipped, true)
        if (unSkipped) onToggleSkipDate(unSkipped, false)
      }}
    />
  )
}

function SkipDatesToggle({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLLabelElement>({
    cornerRadius: TOGGLE_PILL_CORNER_RADIUS,
  })
  return (
    <label
      ref={ref}
      style={style}
      className="flex w-full cursor-pointer items-center justify-between gap-dist-lg rounded-rad-lg border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 py-pad-xs pr-pad-xs pl-pad-md"
    >
      <span className="text-body-lg text-text-bold">Skip some dates</span>
      <Switch checked={enabled} onCheckedChange={onEnabledChange} />
    </label>
  )
}

// The right column from the Figma "Generate (Calendar based)" exports: an
// info line over either a single Calendar (Daily) or the month grid plus an
// optional per-month skip-dates row (Monthly).
function GenerateCalendarColumn({
  cadence,
  dateSelectMethod,
  dailyRange,
  onDailyRangeChange,
  dailyDates,
  onDailyDatesChange,
  monthYear,
  onMonthYearChange,
  selectedMonths,
  onToggleMonth,
  skipDatesEnabled,
  onSkipDatesEnabledChange,
  skippedDates,
  onToggleSkipDate,
  showError,
}: {
  cadence: "daily" | "monthly"
  dateSelectMethod: "range" | "pick"
  dailyRange: DateRange
  onDailyRangeChange: (range: DateRange) => void
  dailyDates: Date[]
  onDailyDatesChange: (dates: Date[]) => void
  monthYear: number
  onMonthYearChange: (year: number) => void
  selectedMonths: MonthSelection[]
  onToggleMonth: (selection: MonthSelection) => void
  skipDatesEnabled: boolean
  onSkipDatesEnabledChange: (enabled: boolean) => void
  skippedDates: Date[]
  onToggleSkipDate: (date: Date, skip: boolean) => void
  showError: boolean
}) {
  const dragScroll = useDragToScroll<HTMLDivElement>()

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-start gap-dist-xl",
        COLUMN_WIDTH_CLASSNAME
      )}
    >
      {cadence === "daily" ? (
        <>
          <p className="flex items-center gap-dist-md text-body-lg text-text-subtle">
            <Info className="size-5 text-icon-subtle" />
            {dateSelectMethod === "range"
              ? // Not in the export (only "Pick dates" has a captured info
                // line) — worded to match its "click dates" phrasing.
                "Click a start date, then an end date"
              : "Click dates to add or remove them"}
          </p>
          {dateSelectMethod === "range" ? (
            <>
              <Calendar mode="range" selected={dailyRange} onSelect={onDailyRangeChange} />
              {/* Restored per direct feedback — this used to render in the
                  provisional demo and got dropped when the real layout was
                  built. */}
              <p className="text-body-md text-text-subtle">
                {dailyRange.from
                  ? `${formatDate(dailyRange.from)}${
                      dailyRange.to ? ` – ${formatDate(dailyRange.to)}` : ""
                    }`
                  : "No range selected"}
              </p>
            </>
          ) : (
            <Calendar
              mode="multiple"
              selected={dailyDates}
              onSelect={onDailyDatesChange}
            />
          )}
        </>
      ) : (
        <>
          <p className="flex items-center gap-dist-md text-body-lg text-text-subtle">
            <Info className="size-5 text-icon-subtle" />
            Select months to generate for
          </p>
          <MonthGrid
            year={monthYear}
            onYearChange={onMonthYearChange}
            selected={selectedMonths}
            onToggleMonth={onToggleMonth}
          />
          <SkipDatesToggle
            enabled={skipDatesEnabled}
            onEnabledChange={onSkipDatesEnabledChange}
          />
          <p className="flex items-center gap-dist-md text-body-md text-text-minimal">
            <Info className="size-5 text-icon-minimal" />
            Choose dates you want to skip
          </p>
          {skipDatesEnabled && selectedMonths.length > 0 ? (
            <div
              ref={dragScroll.ref}
              onPointerDown={dragScroll.onPointerDown}
              onPointerMove={dragScroll.onPointerMove}
              onPointerUp={dragScroll.onPointerUp}
              onPointerCancel={dragScroll.onPointerCancel}
              className={cn(
                "flex w-full shrink-0 cursor-grab touch-pan-x gap-dist-lg overflow-x-auto active:cursor-grabbing",
                HIDE_NATIVE_SCROLLBAR_CLASSNAME
              )}
            >
              {selectedMonths.map((selection) => (
                <MonthSkipCalendar
                  key={`${selection.year}-${selection.month}`}
                  year={selection.year}
                  month={selection.month}
                  skippedDates={skippedDates}
                  onToggleSkipDate={onToggleSkipDate}
                />
              ))}
            </div>
          ) : null}
        </>
      )}

      {showError ? (
        <p className="flex items-center gap-dist-md text-body-lg text-text-danger">
          <WarningCircle className="size-5" weight="fill" />
          Select dates here first
        </p>
      ) : null}
    </div>
  )
}

export { GenerateCalendarColumn }
