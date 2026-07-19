"use client"

import * as React from "react"
import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import {
  HIDE_NATIVE_SCROLLBAR_CLASSNAME,
  useScrollThumb,
} from "@/hooks/use-scroll-thumb"
import { ScrollbarThumb } from "@/components/ui/scrollbar-thumb"

// Figma radii (design-sync/calendar, design-sync/calendar-item) as px for
// the squircle path math — see hooks/use-squircle-clip-path.ts.
const CARD_CORNER_RADIUS = 16
const DAY_CELL_CORNER_RADIUS = 8
const LIST_ITEM_CORNER_RADIUS = 8
const NAV_BUTTON_CORNER_RADIUS = 8

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

// A generous, fixed window rather than the export's open-ended "…" list —
// no infinite-scroll machinery for a first pass.
const YEARS_BACK = 50
const YEARS_FORWARD = 50

export type CalendarSize = "sm" | "md" | "lg"

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

// Card width / day-cell size / list viewport height, all read straight off
// the three Size variants in design-sync/calendar (w-N and size-N below are
// Tailwind's 4px-per-unit numeric scale, e.g. w-80 = 320px = the lg card).
const CALENDAR_SIZE: Record<
  CalendarSize,
  { card: string; cell: string; cellText: string; listHeight: string }
> = {
  sm: { card: "w-52", cell: "size-6", cellText: "text-body-md", listHeight: "h-40" },
  md: { card: "w-66", cell: "size-8", cellText: "text-body-lg", listHeight: "h-52" },
  lg: { card: "w-80", cell: "size-10", cellText: "text-body-lg", listHeight: "h-64" },
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function isSameDay(a: Date | undefined, b: Date | undefined) {
  if (!a || !b) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// Sunday-start grid covering the full month, padded with the trailing days
// of the surrounding months so every row has 7 cells — 5 or 6 rows
// depending on where the month falls, not the export's hardcoded 5 (its
// mock data starts on a Sunday, which real months rarely do).
function getMonthGrid(displayMonth: Date): Date[] {
  const year = displayMonth.getFullYear()
  const month = displayMonth.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const gridStart = new Date(year, month, 1 - firstWeekday)
  return Array.from({ length: totalCells }, (_, i) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + i)
    return date
  })
}

function getYearList(centerYear: number) {
  return Array.from(
    { length: YEARS_BACK + YEARS_FORWARD + 1 },
    (_, i) => centerYear - YEARS_BACK + i
  )
}

type CalendarSingleProps = {
  mode?: "single"
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
}

type CalendarRangeProps = {
  mode: "range"
  selected: DateRange
  onSelect: (range: DateRange) => void
}

// Independent toggled dates — no in-between fill, no start/end ordering.
// Used for both "Pick dates" (starts empty, click adds) and skipping
// specific dates within a month selection (starts full, click removes) —
// the same toggle behavior serves both, only the initial `selected` differs.
type CalendarMultipleProps = {
  mode: "multiple"
  selected: Date[]
  onSelect: (dates: Date[]) => void
}

type CalendarProps = (
  | CalendarSingleProps
  | CalendarRangeProps
  | CalendarMultipleProps
) & {
  size?: CalendarSize
  className?: string
  // Caller-supplied — e.g. blocking past dates. Outside-month cells are
  // always disabled regardless of this.
  disabled?: (date: Date) => boolean
}

// Bigger hit target than the 16px glyph alone (per direct feedback) — the
// -my-2 lets the 32px box overflow the title bar's own tight content row
// without changing the bar's visible height, while staying centered via the
// row's flex alignment.
function CalendarNavButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: NAV_BUTTON_CORNER_RADIUS,
  })
  return (
    <button
      ref={ref}
      style={style}
      type="button"
      aria-label={label}
      onClick={onClick}
      className="-my-2 flex size-8 cursor-pointer items-center justify-center rounded-rad-md text-icon-subtle outline-none transition-colors duration-150 ease-out hover:bg-date-calendar-item-surface-hover hover:text-icon-bold focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  )
}

// Title bar: "Day" view shows the "{Month}. {Year} ⌄" dropdown + prev/next;
// "Month"/"Year" views show a plain centered header, no chevrons — matches
// design-sync/calendar-title-bar's three View= variants exactly.
function CalendarTitleBar({
  view,
  monthLabel,
  year,
  onOpenMonthPicker,
  onPrev,
  onNext,
}: {
  view: "day" | "month" | "year"
  monthLabel: string
  year: number
  onOpenMonthPicker: () => void
  onPrev: () => void
  onNext: () => void
}) {
  if (view !== "day") {
    return (
      <div className="flex h-10 w-full shrink-0 items-center justify-center border-b-[length:var(--stroke-md)] border-border-subtle bg-surface-4 px-pad-md py-pad-sm">
        <span className="text-body-lg text-text-bold">
          {view === "month" ? "Select Month" : "Select Year"}
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-10 w-full shrink-0 items-center justify-between border-b-[length:var(--stroke-md)] border-border-subtle bg-surface-4 px-pad-md py-pad-sm">
      <button
        type="button"
        onClick={onOpenMonthPicker}
        className="flex cursor-pointer items-center gap-dist-sm rounded-rad-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="text-body-lg-bold text-text-bold">{monthLabel}.</span>
        <span className="text-body-lg text-text-bold">{year}</span>
        <CaretDown className="size-4 text-icon-subtle" weight="bold" />
      </button>
      <div className="flex items-center gap-dist-xs">
        <CalendarNavButton label="Previous month" onClick={onPrev}>
          <CaretLeft className="size-5" weight="bold" />
        </CalendarNavButton>
        <CalendarNavButton label="Next month" onClick={onNext}>
          <CaretRight className="size-5" weight="bold" />
        </CalendarNavButton>
      </div>
    </div>
  )
}

function CalendarDayCell({
  date,
  size,
  outsideMonth,
  today,
  selected,
  inRange,
  disabled,
  onSelect,
  onHoverStart,
}: {
  date: Date
  size: CalendarSize
  outsideMonth: boolean
  today: boolean
  selected: boolean
  inRange: boolean
  disabled: boolean
  onSelect: (date: Date) => void
  onHoverStart: (date: Date) => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: DAY_CELL_CORNER_RADIUS,
  })
  const isDisabled = disabled || outsideMonth

  return (
    <button
      ref={ref}
      style={style}
      type="button"
      disabled={isDisabled}
      aria-pressed={selected}
      aria-current={today ? "date" : undefined}
      aria-label={formatFullDate(date)}
      onClick={() => onSelect(date)}
      onMouseEnter={() => onHoverStart(date)}
      className={cn(
        "flex items-center justify-center rounded-rad-md font-medium outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50",
        CALENDAR_SIZE[size].cell,
        CALENDAR_SIZE[size].cellText,
        today && !selected && "border-[length:var(--stroke-lg)] border-border-brand",
        selected
          ? "bg-date-calendar-item-surface-selected text-text-inverse"
          : inRange
            ? "bg-date-calendar-item-surface-range text-text-bold"
            : "cursor-pointer bg-date-calendar-item-surface-rest text-text-bold hover:bg-date-calendar-item-surface-hover",
        isDisabled &&
          "cursor-default bg-date-calendar-item-surface-rest text-text-minimal hover:bg-date-calendar-item-surface-rest"
      )}
    >
      {date.getDate()}
    </button>
  )
}

function CalendarListItem({
  label,
  active,
  onSelect,
  activeRef,
}: {
  label: string
  active: boolean
  onSelect: () => void
  activeRef?: React.RefObject<HTMLButtonElement | null>
}) {
  const { ref: squircleRef, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: LIST_ITEM_CORNER_RADIUS,
  })
  const setRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      squircleRef(node)
      if (activeRef) activeRef.current = node
    },
    [squircleRef, activeRef]
  )

  return (
    <button
      ref={setRef}
      style={style}
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "flex h-9 w-full shrink-0 cursor-pointer items-center justify-center rounded-rad-md text-body-lg text-text-bold outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-date-calendar-item-surface-selected text-text-inverse"
          : "hover:bg-date-calendar-item-surface-hover"
      )}
    >
      {label}
    </button>
  )
}

// Built from the Figma "Calendar" export (design-sync/calendar): a title
// bar over one of three bodies — day grid (default), month list, year list.
// The dropdown in the day view's title bar opens the month list; picking a
// month opens the year list; picking a year lands back on the day grid for
// that month/year — the only reading of "Select Month" then "Select Year"
// that a single dropdown affordance (no independent year trigger) supports.
//
// Range mode (design-sync/calendar's Range=true variant) is a plain
// two-click picker: the first click starts a fresh range, the second
// commits the end (swapped into from/to order if picked backwards) and any
// click after that starts over. While the second date is pending, hovering
// previews the in-between days in the lighter "range" fill so the shape of
// the selection is visible before it's committed.
//
// Multiple mode (not in the export — built for the Generate calendar-based
// flow's "Pick dates" and "skip dates" cases, described in
// components/generate/) is a plain toggle: click adds a date not already in
// `selected`, click again removes it. No ordering, no in-between fill.
//
// No Apply/Cancel footer here — design-sync/calendar-action-bar is a
// separate piece composed in by whatever feature embeds this (e.g. the
// eventual Daily range picker), not part of the calendar itself.
function Calendar(props: CalendarProps) {
  const { size = "lg", className, disabled } = props
  const today = React.useMemo(() => startOfDay(new Date()), [])
  const initialMonth =
    props.mode === "range"
      ? (props.selected.from ?? today)
      : props.mode === "multiple"
        ? (props.selected[0] ?? today)
        : (props.selected ?? today)

  const [view, setView] = React.useState<"day" | "month" | "year">("day")
  const [displayMonth, setDisplayMonth] = React.useState(() =>
    startOfMonth(initialMonth)
  )
  const [hoveredDate, setHoveredDate] = React.useState<Date | undefined>()

  // Two separate clipped layers, same shape as Menu's card (see menu.tsx's
  // layering note): a real CSS border painted on the squircle-clipped card
  // itself gets its own corner arcs, and clipping afterward crops them
  // against a slightly different curve — the mismatch reads as a jagged
  // edge. Splitting the border into its own clipped overlay (an inset
  // shadow, filled in the same clip pass rather than stroked afterward)
  // keeps it crisp; the drop shadow moves to the unclipped wrapper for the
  // same reason a shadow on the card itself would get clipped away.
  const { ref: cardRef, style: cardStyle } = useSquircleClipPath<HTMLDivElement>(
    { cornerRadius: CARD_CORNER_RADIUS }
  )
  const { ref: borderRef, style: borderStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: CARD_CORNER_RADIUS })
  const {
    ref: monthScrollRef,
    thumb: monthThumb,
    visible: monthThumbVisible,
    onScroll: onMonthScroll,
  } = useScrollThumb<HTMLDivElement>()
  const {
    ref: yearScrollRef,
    thumb: yearThumb,
    visible: yearThumbVisible,
    onScroll: onYearScroll,
  } = useScrollThumb<HTMLDivElement>()
  const activeMonthRef = React.useRef<HTMLButtonElement>(null)
  const activeYearRef = React.useRef<HTMLButtonElement>(null)

  const grid = React.useMemo(() => getMonthGrid(displayMonth), [displayMonth])
  const yearList = React.useMemo(
    () => getYearList(today.getFullYear()),
    [today]
  )

  // Bring the current month/year into view the moment either list opens,
  // rather than always starting scrolled to the top.
  React.useEffect(() => {
    if (view === "month") activeMonthRef.current?.scrollIntoView({ block: "center" })
    if (view === "year") activeYearRef.current?.scrollIntoView({ block: "center" })
  }, [view])

  const handleDayClick = (date: Date) => {
    if (props.mode === "range") {
      const { from, to } = props.selected
      if (!from || to) {
        props.onSelect({ from: date, to: undefined })
      } else if (isSameDay(date, from)) {
        // Clicking the pending start date again is a no-op, not a same-day
        // range — otherwise this is the only way to end up with a
        // "July 23 – July 23" range, which reads as a bug, not a range.
        return
      } else if (date < from) {
        props.onSelect({ from: date, to: from })
      } else {
        props.onSelect({ from, to: date })
      }
    } else if (props.mode === "multiple") {
      const exists = props.selected.some((d) => isSameDay(d, date))
      props.onSelect(
        exists
          ? props.selected.filter((d) => !isSameDay(d, date))
          : [...props.selected, date]
      )
    } else {
      props.onSelect(date)
    }
  }

  const isDaySelected = (date: Date) => {
    if (props.mode === "range") {
      return isSameDay(date, props.selected.from) || isSameDay(date, props.selected.to)
    }
    if (props.mode === "multiple") {
      return props.selected.some((d) => isSameDay(d, date))
    }
    return isSameDay(date, props.selected)
  }

  // While a range's second date hasn't been picked yet, the hovered date
  // stands in for `to` so the pending shape previews live.
  const isPendingRangeEnd = (date: Date) =>
    props.mode === "range" &&
    !!props.selected.from &&
    !props.selected.to &&
    isSameDay(date, hoveredDate)

  const isDayInRange = (date: Date) => {
    if (props.mode !== "range") return false
    const { from, to } = props.selected
    const effectiveTo = to ?? (from && !to ? hoveredDate : undefined)
    if (!from || !effectiveTo) return false
    const start = from <= effectiveTo ? from : effectiveTo
    const end = from <= effectiveTo ? effectiveTo : from
    return date > start && date < end
  }

  return (
    <div
      className={cn(
        "relative drop-shadow-[0px_2px_16px_rgba(0,0,0,0.2)]",
        CALENDAR_SIZE[size].card,
        className
      )}
    >
    <div
      ref={cardRef}
      style={cardStyle}
      className="flex w-full flex-col rounded-rad-lg bg-surface-4 p-pad-md"
    >
      <CalendarTitleBar
        view={view}
        monthLabel={MONTH_LABELS[displayMonth.getMonth()]}
        year={displayMonth.getFullYear()}
        onOpenMonthPicker={() => setView("month")}
        onPrev={() => setDisplayMonth((d) => addMonths(d, -1))}
        onNext={() => setDisplayMonth((d) => addMonths(d, 1))}
      />

      {view === "day" ? (
        <div
          className="flex flex-col p-pad-sm"
          onMouseLeave={() => setHoveredDate(undefined)}
        >
          <div className="grid grid-cols-7">
            {WEEKDAY_LABELS.map((label, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-center text-body-lg text-text-subtle",
                  CALENDAR_SIZE[size].cell
                )}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((date) => (
              <CalendarDayCell
                key={date.toISOString()}
                date={date}
                size={size}
                outsideMonth={!isSameMonth(date, displayMonth)}
                today={isSameDay(date, today)}
                selected={isDaySelected(date) || isPendingRangeEnd(date)}
                inRange={isDayInRange(date)}
                disabled={disabled?.(date) ?? false}
                onSelect={handleDayClick}
                onHoverStart={setHoveredDate}
              />
            ))}
          </div>
        </div>
      ) : null}

      {view === "month" ? (
        <div className="relative">
          <div
            ref={monthScrollRef}
            onScroll={onMonthScroll}
            className={cn(
              "flex flex-col overflow-y-auto p-pad-sm",
              CALENDAR_SIZE[size].listHeight,
              HIDE_NATIVE_SCROLLBAR_CLASSNAME
            )}
          >
            {MONTH_LABELS.map((label, i) => (
              <CalendarListItem
                key={label}
                label={label}
                active={i === displayMonth.getMonth()}
                activeRef={i === displayMonth.getMonth() ? activeMonthRef : undefined}
                onSelect={() => {
                  setDisplayMonth((d) => new Date(d.getFullYear(), i, 1))
                  setView("year")
                }}
              />
            ))}
          </div>
          <ScrollbarThumb
            thumb={monthThumb}
            visible={monthThumbVisible}
            className="right-1"
          />
        </div>
      ) : null}

      {view === "year" ? (
        <div className="relative">
          <div
            ref={yearScrollRef}
            onScroll={onYearScroll}
            className={cn(
              "flex flex-col overflow-y-auto p-pad-sm",
              CALENDAR_SIZE[size].listHeight,
              HIDE_NATIVE_SCROLLBAR_CLASSNAME
            )}
          >
            {yearList.map((year) => (
              <CalendarListItem
                key={year}
                label={String(year)}
                active={year === displayMonth.getFullYear()}
                activeRef={year === displayMonth.getFullYear() ? activeYearRef : undefined}
                onSelect={() => {
                  setDisplayMonth((d) => new Date(year, d.getMonth(), 1))
                  setView("day")
                }}
              />
            ))}
          </div>
          <ScrollbarThumb
            thumb={yearThumb}
            visible={yearThumbVisible}
            className="right-1"
          />
        </div>
      ) : null}
    </div>
      <div
        ref={borderRef}
        style={borderStyle}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-rad-lg shadow-[inset_0_0_0_var(--stroke-lg)_var(--border-bold)]"
      />
    </div>
  )
}

export { Calendar }
