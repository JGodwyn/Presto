"use client"

import { CaretLeft, CaretRight } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma radii as px for the squircle path math: the card (--rad-lg), the
// year-nav buttons and month pills (both --rad-md).
const CARD_CORNER_RADIUS = 16
const NAV_BUTTON_CORNER_RADIUS = 8
const PILL_CORNER_RADIUS = 8

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

// A selected month, identified by year+month rather than just a month
// index — the year nav means the same "July" chip means something different
// after paging to a different year.
export interface MonthSelection {
  year: number
  month: number
}

function isMonthSelected(selection: MonthSelection[], year: number, month: number) {
  return selection.some((s) => s.year === year && s.month === month)
}

function YearNavButton({
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
      className="flex size-7 cursor-pointer items-center justify-center rounded-rad-md border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 text-icon-bold outline-none transition-colors duration-150 ease-out hover:bg-date-calendar-item-surface-hover focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  )
}

// Same visual language as Chip (components/ui/chip.tsx) — solid gray when
// selected, flat surface-3 outline otherwise — but a real toggle button
// rather than a display tag with a remove affordance, since these are
// picked/unpicked directly rather than added via a search field.
function MonthPill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: PILL_CORNER_RADIUS,
  })
  return (
    <button
      ref={ref}
      style={style}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex h-8 cursor-pointer items-center gap-dist-md rounded-rad-md border-[length:var(--stroke-lg)] px-pad-sm py-pad-xs text-body-lg outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-gray-600 bg-gray-400 text-text-inverse"
          : "border-border-subtle bg-surface-3 text-text-subtle hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)]"
      )}
    >
      {label}
    </button>
  )
}

// "Select months to generate for" card from the Figma "Generate (Calendar
// based) / Monthly" exports: year navigation over a flex-wrap grid of month
// pills (wraps naturally at varying widths per label — "September" pushes
// the row differently than "May" — matching the export's own uneven
// row-break rather than a fixed grid-cols).
function MonthGrid({
  year,
  onYearChange,
  selected,
  onToggleMonth,
}: {
  year: number
  onYearChange: (year: number) => void
  selected: MonthSelection[]
  onToggleMonth: (selection: MonthSelection) => void
}) {
  const { ref: cardRef, style: cardStyle } = useSquircleClipPath<HTMLDivElement>(
    { cornerRadius: CARD_CORNER_RADIUS }
  )

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      className="flex w-full flex-col gap-dist-lg rounded-rad-lg border-[length:var(--stroke-md)] border-border-subtle bg-surface-4 p-pad-lg"
    >
      <div className="flex items-center gap-dist-xl py-pad-xs">
        <YearNavButton label="Previous year" onClick={() => onYearChange(year - 1)}>
          <CaretLeft className="size-4" weight="bold" />
        </YearNavButton>
        <span className="text-heading-sm font-display text-text-bold">{year}</span>
        <YearNavButton label="Next year" onClick={() => onYearChange(year + 1)}>
          <CaretRight className="size-4" weight="bold" />
        </YearNavButton>
      </div>
      <div className="flex flex-wrap gap-dist-md">
        {MONTH_LABELS.map((label, month) => (
          <MonthPill
            key={label}
            label={label}
            selected={isMonthSelected(selected, year, month)}
            onClick={() => onToggleMonth({ year, month })}
          />
        ))}
      </div>
    </div>
  )
}

export { MonthGrid, MONTH_LABELS }
