"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import {
  formatTime12,
  stepHour,
  type Meridiem,
  type TimeOfDay,
} from "@/lib/time-of-day"

// Figma radii (design-sync/calendar-with-time-daily, -monthly) as px for the
// squircle path math — the surface-2 tray is rad-lg, each segment rad-xmd.
const TRAY_CORNER_RADIUS = 16
const SEGMENT_CORNER_RADIUS = 12

// The bookends either side of the tray in both exports: a 16px surface-2 disc
// with a 4px dark dot in it. Purely a mark — nothing about the export makes
// them controls, and a control that flanks a three-part field wouldn't say
// which part it acted on. Round, so no squircle (a fully-rounded shape has no
// straight edge for corner smoothing to blend into — same exception
// components/ui/toast.tsx documents).
function TimeFieldMark() {
  return (
    <span
      aria-hidden
      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-surface-2"
    >
      <span className="size-1 rounded-full bg-gray-1000" />
    </span>
  )
}

// The hour and minute boxes. A text input rather than `type="number"`: the
// number type brings its own spinners and lets a browser accept "e", "-" and
// arbitrarily long values, none of which belong on a two-digit clock segment.
// Filtering to digits on the way in is what keeps this a number field.
function TimeSegmentInput({
  label,
  value,
  min,
  max,
  pad,
  onCommit,
  onStep,
}: {
  label: string
  value: number
  min: number
  max: number
  // Minutes read "00", hours read "9" — the export shows both.
  pad: boolean
  onCommit: (value: number) => void
  // Overrides the arrow keys' default wrap-in-place. The hour needs it: its
  // range doesn't stand alone, since rolling past 11 has to move the meridiem
  // too, and this component has no idea that exists. `from` is whatever the
  // box currently reads, clamped into range.
  onStep?: (delta: number, from: number) => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLInputElement>({
    cornerRadius: SEGMENT_CORNER_RADIUS,
  })

  const display = pad ? String(value).padStart(2, "0") : String(value)
  // What's actually in the box while it has focus, tracked separately from
  // the committed value. Without it, padding and clamping would fight the
  // typist on every keystroke — "1" on the way to "12" would clamp up to the
  // minimum, and an emptied box would refill itself before the next digit.
  // Cleared on blur, which is when the display goes back to the canonical
  // (padded, clamped) form.
  const [draft, setDraft] = React.useState<string | null>(null)

  // Arrows step and wrap — a clock has no ends, and wrapping is what lets the
  // hour roll 12 → 1 rather than sticking at either end.
  //
  // Stepping starts from what the box actually reads, draft included. Reading
  // `value` instead meant an out-of-range entry being corrected with an arrow
  // silently discarded the typed digit and jumped from the last committed
  // number — type "0" over a 9 and press Up, and you got 10.
  const step = (delta: number) => {
    const parsed = draft === null || draft === "" ? NaN : Number(draft)
    const from = Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, parsed))
      : value
    setDraft(null)
    if (onStep) {
      onStep(delta, from)
      return
    }
    const span = max - min + 1
    onCommit(min + ((((from - min + delta) % span) + span) % span))
  }

  return (
    <input
      ref={ref}
      style={style}
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={draft ?? display}
      onChange={(event) => {
        // Digits only, and never more than the widest legal entry.
        const next = event.target.value.replace(/\D/g, "").slice(0, String(max).length)
        setDraft(next)
        // Commit as it's typed, so the value is live rather than waiting on a
        // blur that may never come (clicking Generate straight from the field
        // doesn't blur it in every browser). Out-of-range entries are held in
        // the draft instead — clamping mid-word is what makes a field fight
        // back — and settled on blur.
        const parsed = Number(next)
        if (next !== "" && parsed >= min && parsed <= max) onCommit(parsed)
      }}
      onBlur={(event) => {
        const raw = event.target.value.replace(/\D/g, "")
        setDraft(null)
        if (raw === "") return
        onCommit(Math.min(max, Math.max(min, Number(raw))))
      }}
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault()
          step(1)
        } else if (event.key === "ArrowDown") {
          event.preventDefault()
          step(-1)
        } else if (event.key === "Enter") {
          event.currentTarget.blur()
        }
      }}
      className="h-10 w-12 shrink-0 rounded-rad-xmd bg-surface-4 px-pad-md py-pad-sm text-center text-body-lg text-text-bold tabular-nums outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  )
}

// AM/PM. Two options is one tap, not a dropdown — per direct request, and the
// export draws it as the same box as the two number segments rather than
// anything with a caret.
function MeridiemToggle({
  value,
  onChange,
}: {
  value: Meridiem
  onChange: (value: Meridiem) => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: SEGMENT_CORNER_RADIUS,
  })

  return (
    <button
      ref={ref}
      style={style}
      type="button"
      // The label carries what a tap does, since the visible text is the
      // current state rather than the action.
      aria-label={`${value}, switch to ${value === "AM" ? "PM" : "AM"}`}
      onClick={() => onChange(value === "AM" ? "PM" : "AM")}
      className="flex h-10 w-12 shrink-0 cursor-pointer items-center justify-center rounded-rad-xmd bg-surface-4 px-pad-md py-pad-sm text-body-lg text-text-bold transition-[background-color,scale] duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-4),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
    >
      {value}
    </button>
  )
}

// The time-of-day row from design-sync/calendar-with-time-daily and
// -monthly: a surface-2 tray holding hour : minute : AM/PM, flanked by the
// two marks. Identical in both exports — the daily one sits inside the
// Calendar card under the day grid, the monthly one under the month chips —
// so it's one component both compose.
function TimeField({
  value,
  onChange,
  className,
}: {
  value: TimeOfDay
  onChange: (value: TimeOfDay) => void
  className?: string
}) {
  const { ref: trayRef, style: trayStyle } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: TRAY_CORNER_RADIUS,
  })

  return (
    <div
      role="group"
      aria-label={`Time to post: ${formatTime12(value)}`}
      className={cn("flex w-full items-center justify-center gap-dist-md", className)}
    >
      <TimeFieldMark />
      <div
        ref={trayRef}
        style={trayStyle}
        className="flex items-center gap-dist-sm rounded-rad-lg bg-surface-2 p-pad-xs"
      >
        <TimeSegmentInput
          label="Hour"
          value={value.hour}
          min={1}
          max={12}
          pad={false}
          onCommit={(hour) => onChange({ ...value, hour })}
          // Through stepHour rather than the default wrap: the hour and the
          // meridiem are one value split across two controls, so 11 AM + 1 is
          // 12 PM, not 12 AM. See lib/time-of-day.ts.
          onStep={(delta, from) =>
            onChange(stepHour({ ...value, hour: from }, delta))
          }
        />
        <span aria-hidden className="text-body-lg-bold text-text-subtle">
          :
        </span>
        <TimeSegmentInput
          label="Minute"
          value={value.minute}
          min={0}
          max={59}
          pad
          onCommit={(minute) => onChange({ ...value, minute })}
        />
        <span aria-hidden className="text-body-lg-bold text-text-subtle">
          :
        </span>
        <MeridiemToggle
          value={value.meridiem}
          onChange={(meridiem) => onChange({ ...value, meridiem })}
        />
      </div>
      <TimeFieldMark />
    </div>
  )
}

export { TimeField }
