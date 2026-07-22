"use client"

import * as React from "react"
import { Info, Warning } from "@phosphor-icons/react"

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

// Leaves a little breathing room before the true viewport edge — the row
// can otherwise end up exactly flush with it.
const RIGHT_SAFETY_MARGIN_PX = 32
// Rubber-band drag: how far past either end the row can be pulled, and how
// much of the raw pointer delta actually gets through once past an edge
// (< 1 so it visibly resists rather than tracking 1:1).
const ELASTIC_MAX_PX = 72
const ELASTIC_RESISTANCE = 0.35
// How wide a fade-to-transparent runs in from each side of the carousel
// viewport (a CSS mask, not overflow) — softens the otherwise-sharp vertical
// line a calendar gets sliced by mid-scroll.
const EDGE_FADE_PX = 24
const EDGE_FADE_MASK = `linear-gradient(to right, transparent, black ${EDGE_FADE_PX}px, black calc(100% - ${EDGE_FADE_PX}px), transparent)`

// Click-and-drag horizontal scrolling for the skip-dates calendar row,
// alongside the wheel/trackpad scrolling overflow-x-auto already gives for
// free. Bundles three things:
// - A drag threshold: a pointerdown+pointerup with under 4px of movement
//   still reaches the underlying day-cell button as an ordinary click.
// - A measured, capped breakout width (see maxWidthPx below) rather than a
//   flat "+336px" guess — the flat version could claim more width than the
//   page actually has room for at a given viewport size, which left part of
//   the row's own viewport sitting behind GeneratePanel's overflow-hidden:
//   clientWidth included space that was never actually paintable, so no
//   amount of scrolling could bring the last calendar into that dead zone.
// - Elastic overshoot at either end: past the natural scroll bounds, the
//   row still visually follows the drag (resisted, capped at
//   ELASTIC_MAX_PX) via a transform on the inner content wrapper — actual
//   scrollLeft stays clamped to its real range throughout — and springs
//   back the instant the pointer releases.
function useCarouselScroll<T extends HTMLElement>() {
  const elRef = React.useRef<T | null>(null)
  const dragRef = React.useRef<{
    startX: number
    startScrollLeft: number
    dragging: boolean
  } | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [elasticOffset, setElasticOffset] = React.useState(0)
  const [maxWidthPx, setMaxWidthPx] = React.useState<number>()

  const measure = React.useCallback(() => {
    const el = elRef.current
    if (!el) return
    // Measuring against window.innerWidth alone ignores page padding and
    // the sidebar, so it can under-clip — this walks up to the actual
    // element that clips content (GeneratePanel's own overflow-hidden,
    // marked with data-clip-boundary) and measures against its real right
    // edge instead, however much page chrome sits in between.
    const boundary = el.closest<HTMLElement>("[data-clip-boundary]")
    const boundaryRight = boundary
      ? boundary.getBoundingClientRect().right
      : window.innerWidth
    const left = el.getBoundingClientRect().left
    setMaxWidthPx(Math.max(boundaryRight - left - RIGHT_SAFETY_MARGIN_PX, 0))
  }, [])

  // A callback ref, not useRef+useEffect: this row only exists in the DOM
  // once "Skip some dates" is on AND at least one month is selected — on
  // first mount neither may be true yet, so a dependency-array effect tied
  // to `[]` would run once against a null ref and never get a second
  // chance when the row actually appears later. A callback ref re-fires on
  // every real attach (same reasoning as use-squircle-clip-path.ts).
  const ref = React.useCallback(
    (node: T | null) => {
      elRef.current = node
      measure()
    },
    [measure]
  )

  React.useEffect(() => {
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure])

  const onPointerDown = (event: React.PointerEvent) => {
    const el = elRef.current
    if (!el) return
    dragRef.current = {
      startX: event.clientX,
      startScrollLeft: el.scrollLeft,
      dragging: false,
    }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const el = elRef.current
    const drag = dragRef.current
    if (!el || !drag) return
    const dx = event.clientX - drag.startX
    if (!drag.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
      drag.dragging = true
      setIsDragging(true)
      el.setPointerCapture(event.pointerId)
    }
    const target = drag.startScrollLeft - dx
    const maxScroll = el.scrollWidth - el.clientWidth
    if (target < 0) {
      el.scrollLeft = 0
      setElasticOffset(Math.min(-target * ELASTIC_RESISTANCE, ELASTIC_MAX_PX))
    } else if (target > maxScroll) {
      el.scrollLeft = maxScroll
      setElasticOffset(-Math.min((target - maxScroll) * ELASTIC_RESISTANCE, ELASTIC_MAX_PX))
    } else {
      el.scrollLeft = target
      setElasticOffset(0)
    }
  }

  const endDrag = () => {
    dragRef.current = null
    setIsDragging(false)
    setElasticOffset(0)
  }

  return {
    ref,
    maxWidthPx,
    isDragging,
    elasticOffset,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  }
}

// A stable reference for the "toggle is off" case below — a fresh `[]`
// literal on every render would give useCarouselPresence's effect (which
// depends on this array by reference) a "changed" input on every single
// render, regardless of content, driving it into an infinite render loop
// (React's "Maximum update depth exceeded").
const NO_MONTHS: MonthSelection[] = []

function monthKey(selection: MonthSelection) {
  return `${selection.year}-${selection.month}`
}

function byChronologicalOrder(a: MonthSelection, b: MonthSelection) {
  return a.year - b.year || a.month - b.month
}

interface CarouselItem {
  key: string
  selection: MonthSelection
  exiting: boolean
}

// Matches the exit transition's own duration-200 (Tailwind class at the
// call site, kept in sync by hand); the extra 50ms is slack for the
// fallback timer below, not part of the visible animation. Dropped from
// 300ms per direct feedback — this fires on ordinary list add/remove, not
// a rare first-time moment, so it belongs closer to the review-animations
// "small popover" range than the page-level mount-in convention elsewhere
// in the app.
const EXIT_ANIMATION_MS = 200
const EXIT_FALLBACK_BUFFER_MS = 50

// React has no built-in way to animate an item out before it unmounts — the
// DOM node is simply gone the instant `selectedMonths` stops including it.
// This keeps a locally-owned copy that lags the real prop by one exit
// animation: a month dropped from `selectedMonths` is first marked
// `exiting` here (still rendered, now carrying the exit classes below) and
// only actually removed once its transition finishes — see the exiting
// wrapper's onTransitionEnd at the call site.
//
// Each exit also arms a setTimeout backup that force-removes the item even
// if onTransitionEnd never fires — browsers suspend transitions (and thus
// the events marking their completion) for backgrounded/hidden tabs, so
// relying on the event alone can leave an item stuck mid-fade forever if
// the user switches away mid-animation. The timeout is cancelled the
// instant the item's own removal actually happens, from whichever path
// gets there first.
function useCarouselPresence(selectedMonths: MonthSelection[]) {
  const [items, setItems] = React.useState<CarouselItem[]>(() =>
    selectedMonths
      .map((selection) => ({ key: monthKey(selection), selection, exiting: false }))
      .sort((a, b) => byChronologicalOrder(a.selection, b.selection))
  )
  const fallbackTimeouts = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const settle = React.useCallback((key: string) => {
    const timeout = fallbackTimeouts.current.get(key)
    if (timeout) {
      clearTimeout(timeout)
      fallbackTimeouts.current.delete(key)
    }
    setItems((prev) => prev.filter((item) => item.key !== key))
  }, [])

  React.useEffect(() => {
    setItems((prev) => {
      const currentKeys = new Set(selectedMonths.map(monthKey))
      const prevKeys = new Set(prev.map((item) => item.key))
      // Re-selecting a month while its exit animation is still playing
      // should cancel that exit, not queue a duplicate — explicitly
      // resetting `exiting` (rather than leaving already-tracked items
      // untouched) is what makes that cancellation happen.
      const stillTracked = prev.map((item) => {
        if (currentKeys.has(item.key)) {
          const timeout = fallbackTimeouts.current.get(item.key)
          if (timeout) {
            clearTimeout(timeout)
            fallbackTimeouts.current.delete(item.key)
          }
          return { ...item, exiting: false }
        }
        // Only arm a fallback the moment an item *becomes* exiting, not on
        // every subsequent effect run while it's still mid-exit — otherwise
        // an unrelated selectedMonths change (adding a different month)
        // would keep pushing this one's removal further out.
        if (!item.exiting) {
          const timeout = setTimeout(
            () => settle(item.key),
            EXIT_ANIMATION_MS + EXIT_FALLBACK_BUFFER_MS
          )
          fallbackTimeouts.current.set(item.key, timeout)
        }
        return { ...item, exiting: true }
      })
      const arriving = selectedMonths
        .filter((selection) => !prevKeys.has(monthKey(selection)))
        .map((selection) => ({
          key: monthKey(selection),
          selection,
          exiting: false,
        }))
      return [...stillTracked, ...arriving].sort((a, b) =>
        byChronologicalOrder(a.selection, b.selection)
      )
    })
  }, [selectedMonths, settle])

  React.useEffect(() => {
    const timeouts = fallbackTimeouts.current
    return () => {
      timeouts.forEach(clearTimeout)
      timeouts.clear()
    }
  }, [])

  return { items, settle }
}

// Matches the segmented control indicator's own move-on-screen timing — the
// "quick move" curve reserved for existing elements repositioning, distinct
// from the mount-in curve the enter/exit fade above uses. Kept quick per
// direct feedback (dropped from 200ms — still comfortably inside the
// review-animations "moving/morphing on screen" range, just at the fast end).
const REORDER_DURATION_MS = 150
const REORDER_EASING = "cubic-bezier(0.77,0,0.175,1)"

// FLIP (First-Last-Invert-Play): when a calendar leaves the carousel, the
// remaining ones snap to their new flex position the instant the DOM
// updates — flex reflow isn't something CSS can transition on its own.
// This measures each surviving item's position before and after a reflow,
// then plays a translateX from the old delta down to zero. Freshly-arriving
// items are skipped (no prior position to invert from); they already get
// their own enter animation from the caller.
//
// Runs the move via the Web Animations API rather than a CSS `transition`
// written through inline style — that was the original implementation, and
// it had a real bug: `node.style.transition = "transform 150ms ..."` sets
// the *shorthand* `transition` property, which fully replaces (not merges
// with) this same wrapper's class-driven
// `transition-[opacity,filter,scale] duration-200` used for its own
// exit/enter fade below, since inline style always wins over a class for
// the same property. Once an item had been through even one reorder, its
// wrapper's `transition` stayed permanently pinned to `transform` only —
// silently disabling that item's *own* future exit fade, which is exactly
// why removing the last remaining item still snapped instead of fading
// whenever it had previously been shifted by an earlier removal.
// `element.animate()` is entirely independent of the CSS `transition`
// property, so a reorder and a fade on the same element can never collide.
// Cancelling any still-in-flight reorder animation on a node before
// starting a new one also prevents two reorders landing close together
// from fighting over the same transform — without that, the next
// measurement below would read a mid-flight position instead of the
// settled one, producing the "moves forward, then back" jitter.
function useFlipReorder(keys: string[]) {
  const nodes = React.useRef(new Map<string, HTMLElement>())
  const refCache = React.useRef(new Map<string, (node: HTMLElement | null) => void>())
  const prevLefts = React.useRef(new Map<string, number>())
  const activeAnimations = React.useRef(new Map<string, Animation>())

  const register = React.useCallback((key: string) => {
    let cached = refCache.current.get(key)
    if (!cached) {
      cached = (node) => {
        if (node) nodes.current.set(key, node)
        else nodes.current.delete(key)
      }
      refCache.current.set(key, cached)
    }
    return cached
  }, [])

  React.useLayoutEffect(() => {
    const newLefts = new Map<string, number>()
    nodes.current.forEach((node, key) => {
      newLefts.set(key, node.getBoundingClientRect().left)
    })

    nodes.current.forEach((node, key) => {
      const oldLeft = prevLefts.current.get(key)
      const newLeft = newLefts.get(key)
      if (oldLeft === undefined || newLeft === undefined) return
      const delta = oldLeft - newLeft
      if (delta === 0) return

      activeAnimations.current.get(key)?.cancel()
      const animation = node.animate(
        [{ transform: `translateX(${delta}px)` }, { transform: "none" }],
        { duration: REORDER_DURATION_MS, easing: REORDER_EASING }
      )
      activeAnimations.current.set(key, animation)
      animation.finished.catch(() => {}).finally(() => {
        if (activeAnimations.current.get(key) === animation) {
          activeAnimations.current.delete(key)
        }
      })
    })

    prevLefts.current = newLefts
    // Re-run whenever the actual sequence of rendered keys changes (an
    // item joining or leaving) — that's the only time a reflow this hook
    // needs to correct for can happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(",")])

  return { register }
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
      // The displayed month is dictated by the month grid above, not by
      // navigating this calendar directly — the only action here is
      // toggling days, per direct feedback.
      disableNavigation
      // The carousel row only has so much padding to let a shadow bleed
      // into before its own overflow clips it — the lighter, tighter-blur
      // "sm" shadow (components/ui/calendar.tsx's SHADOW_CLASSNAMES) fits
      // inside that with room to spare. Adjust the shadow itself there;
      // this is just the on/off switch for this one context.
      shadow="sm"
      // Never flex-shrunk in the carousel row below (default flex-shrink:1
      // would otherwise squeeze every card to fit, per direct feedback).
      className="shrink-0"
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
  const dragScroll = useCarouselScroll<HTMLDivElement>()
  // Empty (not `selectedMonths`) once the toggle itself is off, so turning
  // it off — or deselecting the very last month — reads as "everything
  // exits" to the presence hook instead of "the row disappears out from
  // under whatever was still mid-exit." See the row's own render condition
  // below, which now keys off the presence list rather than this prop.
  const carouselPresence = useCarouselPresence(
    skipDatesEnabled ? selectedMonths : NO_MONTHS
  )
  const flipReorder = useFlipReorder(carouselPresence.items.map((item) => item.key))

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
          {/* -mt-dist-lg: the parent column's own gap-dist-xl (24px) is
              right for most of its children, but this one specifically
              should sit dist-md (8px) below the toggle above it, per
              annotation — dist-xl minus dist-lg (16px) is exactly dist-md,
              so this cancels the parent gap down to the target distance
              without touching the column's other gaps. */}
          <p className="-mt-dist-lg flex items-center gap-dist-md text-body-md text-text-minimal">
            <Info className="size-5 text-icon-minimal" />
            Choose dates you want to skip
          </p>
          {carouselPresence.items.length > 0 ? (
            <div
              ref={dragScroll.ref}
              onPointerDown={dragScroll.onPointerDown}
              onPointerMove={dragScroll.onPointerMove}
              onPointerUp={dragScroll.onPointerUp}
              onPointerCancel={dragScroll.onPointerCancel}
              style={{
                maxWidth: dragScroll.maxWidthPx,
                // Fades the viewport's own left/right edges to transparent
                // instead of ending in a hard line — a calendar scrolling
                // through no longer looks like it's being sliced by an
                // invisible blade. Standard + -webkit- for Safari; adjust
                // EDGE_FADE_PX above to widen/narrow the fade.
                maskImage: EDGE_FADE_MASK,
                WebkitMaskImage: EDGE_FADE_MASK,
              }}
              className={cn(
                // Bleeds past this column's own right edge (a fixed,
                // explicit width — one calendar-width plus gap, 320+16 —
                // plus a matching negative right margin, not a percentage:
                // the left edge stays put, only the right edge moves) so
                // more of the carousel shows before a scroll/drag is
                // needed. The inline maxWidth clamps that bleed to whatever
                // room is actually measured before the true viewport edge —
                // see useCarouselScroll's comment for why the unclamped
                // version could make part of the row permanently
                // unreachable.
                //
                // py-5/-my-5: setting overflow-x here implicitly forces
                // overflow-y to "auto" too (a CSS Overflow spec rule — you
                // can't pair one axis's scrolling value with the other left
                // at "visible"), which was clipping every calendar's own
                // drop-shadow flat at the row's top/bottom edge. The
                // padding gives the shadow room to render before it hits
                // that clip; the matching negative margin cancels the
                // padding's own effect on surrounding layout so the row's
                // visible footprint is unchanged.
                //
                // px-6/-ml-6: the edge-fade mask above was fading directly
                // against the row's own boundary, which is exactly where a
                // resting (unscrolled) calendar's own edge sits too — so it
                // visibly dimmed calendars that weren't mid-scroll at all.
                // px-6 (6 units = 24px, matching EDGE_FADE_PX — keep these
                // in sync by hand) buffers resting content away from the
                // fade zone on both sides; -ml-6 cancels the left padding's
                // shift so the first calendar still lines up with "Choose
                // dates you want to skip" above it, same as before.
                "-mr-84 -my-5 -ml-6 flex w-[calc(100%+336px)] shrink-0 cursor-grab touch-pan-x select-none overflow-x-auto px-6 py-5 active:cursor-grabbing",
                HIDE_NATIVE_SCROLLBAR_CLASSNAME
              )}
            >
              <div
                // items-start: calendars hug their own content height (a
                // 4-row month like February vs. a 6-row month) rather than
                // the flex default of stretching every card to match the
                // tallest one in the row.
                className="flex items-start gap-dist-lg"
                style={{
                  transform: `translateX(${dragScroll.elasticOffset}px)`,
                  // No transition while actively dragging — the offset
                  // needs to track the pointer 1:1. Only once released does
                  // it spring back, on the same strong ease-in-out curve
                  // used elsewhere for on-screen movement (e.g.
                  // SegmentedControl's indicator).
                  transition: dragScroll.isDragging
                    ? "none"
                    : "transform 200ms cubic-bezier(0.77,0,0.175,1)",
                }}
              >
                {carouselPresence.items.map((item) => (
                  <div
                    key={item.key}
                    ref={flipReorder.register(item.key)}
                    // Only react to the transition finishing on this exact
                    // wrapper — opacity/filter/scale each fire their own
                    // transitionend, and a bubbled one from something
                    // inside the calendar (a hover state, say) shouldn't
                    // count.
                    onTransitionEnd={(event) => {
                      if (event.target === event.currentTarget && item.exiting) {
                        carouselPresence.settle(item.key)
                      }
                    }}
                    className={cn(
                      "shrink-0 transition-[opacity,filter,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                      "starting:scale-90 starting:opacity-0 starting:blur-[8px]",
                      item.exiting && "scale-90 opacity-0 blur-[8px]"
                    )}
                  >
                    <MonthSkipCalendar
                      year={item.selection.year}
                      month={item.selection.month}
                      skippedDates={skippedDates}
                      onToggleSkipDate={onToggleSkipDate}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {showError ? (
        <p className="flex items-center gap-dist-md text-body-lg text-text-danger">
          <Warning className="size-5" weight="bold" />
          Select dates here first
        </p>
      ) : null}
    </div>
  )
}

export { GenerateCalendarColumn }
