"use client"

import * as React from "react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import {
  CaretDown,
  Equals,
  MagicWand,
  PlugCharging,
  XLogo,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { type DateRange } from "@/components/ui/calendar"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { GenerateCalendarColumn } from "@/components/generate/generate-calendar-column"
import { type MonthSelection } from "@/components/generate/month-grid"
import { NumberStepper } from "@/components/generate/number-stepper"
import { RadioCardGroup } from "@/components/generate/radio-card-group"
import { ScheduledPostsBar } from "@/components/generate/scheduled-posts-bar"
import {
  SelectPill,
  type SelectPillOption,
} from "@/components/generate/select-pill"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma radii as px for the squircle path math: the surface-3 stepper box
// (--rad-lg) and the "Instructions plugged in" tag (--rad-md).
const STEPPER_BOX_CORNER_RADIUS = 16
const PLUGGED_TAG_CORNER_RADIUS = 8

// 1–31: up to a full month of dailies (raised from the UX doc §8.2's 20 per
// direct feedback).
const MIN_POSTS = 1
const MAX_POSTS = 31

// Placeholder lists until generation settings are wired up — the real model
// list belongs to Settings and the account list to Connections.
const MODEL_OPTIONS: SelectPillOption[] = [
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-sonnet", label: "Claude Sonnet" },
  { value: "claude-haiku", label: "Claude Haiku" },
]

const LINKEDIN_ICON = (
  <Image src="/images/generate/linkedin.svg" alt="" width={16} height={16} />
)

const ACCOUNT_OPTIONS: SelectPillOption[] = [
  { value: "linkedin", label: "LinkedIn", icon: LINKEDIN_ICON },
  { value: "x", label: "X", icon: <XLogo className="size-4" /> },
]

const CADENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
]

const DATE_SELECT_OPTIONS = [
  { value: "range", label: "Date range" },
  { value: "pick", label: "Pick dates" },
]

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function countDaysInclusive(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

export interface GenerateCardHandle {
  // Resets whichever mode's selection is active: the number stepper back
  // to MIN_POSTS (1) for number-based, and the calendar back to an empty
  // selection (0 scheduled posts) for calendar-based — not
  // mode/model/account, since the trigger for this (a button in
  // GeneratePanel, above GenerateCard) is scoped to "reset the selection,"
  // not "reset the whole form."
  resetCalendar: () => void
}

// Built from the Figma "Generate (Number based)" export and the corrected
// "Generate (Calendar based) / layout" export (design-sync/
// genrate-calendar-based-layout — the first calendar-based pass had the
// title/tabs/info-line living inside the left settings column, which is
// only 440px and sits at the *left* edge of the wider two-column row rather
// than centered in it, so the header visibly jumped left on switching
// tabs). The fix in that export: title/tabs/info-line are centered in an
// outer column that's the same width in both modes; only the content below
// them — a single w-110 block for number-based, or a left-aligned settings
// column + GenerateCalendarColumn row for calendar-based — changes shape.
// Model/account and the Generate button/plug footer are identical in both
// modes' exports, so `modelAccountAndActions` below renders once and both
// branches place it.
//
// forwardRef + useImperativeHandle: the reset button that triggers
// `resetCalendar` lives in GeneratePanel, which wraps this component as
// `children` — a parent has no other way to reach into a self-contained
// child's internal state without either lifting all of it up (a much
// bigger change to how this component owns its own state) or exposing a
// narrow imperative method like this one.
export const GenerateCard = React.forwardRef<GenerateCardHandle>(
  function GenerateCard(_props, ref) {
    const router = useRouter()
    const { projectId } = useParams<{ projectId: string }>()
    // router.push doesn't resolve the instant it's called — the target
    // route's own code/data still has to load first, which is where the
    // reported click-to-navigate delay lives. Wrapping it in a transition
    // gives isPending as a signal for that exact gap, so the button can read
    // "Generating" instead of sitting there looking unclicked.
    const [isNavigatingToGenerating, startNavigateToGenerating] =
      React.useTransition()

    // Warms the /generating route's own JS chunk ahead of the click —
    // clicking a plain Button (unlike <Link>, which Next prefetches
    // automatically on viewport visibility/hover) gave this route no chance
    // to prefetch beforehand, which is most of where the reported delay
    // between click and the new screen actually was coming from.
    React.useEffect(() => {
      router.prefetch(`/projects/${projectId}/generate/generating`)
    }, [router, projectId])

    const [mode, setMode] = React.useState("number")
    const [count, setCount] = React.useState(MIN_POSTS)
    const [model, setModel] = React.useState(MODEL_OPTIONS[0].value)
    const [account, setAccount] = React.useState(ACCOUNT_OPTIONS[0].value)

    const [cadence, setCadence] = React.useState<"daily" | "monthly">("daily")
    const [dateSelectMethod, setDateSelectMethod] = React.useState<
      "range" | "pick"
    >("pick")
    const [dailyRange, setDailyRange] = React.useState<DateRange>({
      from: undefined,
      to: undefined,
    })
    const [dailyDates, setDailyDates] = React.useState<Date[]>([])
    const [monthYear, setMonthYear] = React.useState(() => new Date().getFullYear())
    const [selectedMonths, setSelectedMonths] = React.useState<MonthSelection[]>(
      []
    )
    const [skipDatesEnabled, setSkipDatesEnabled] = React.useState(false)
    const [skippedDates, setSkippedDates] = React.useState<Date[]>([])
    const [showError, setShowError] = React.useState(false)

    const { ref: boxRef, style: boxStyle } = useSquircleClipPath<HTMLDivElement>(
      { cornerRadius: STEPPER_BOX_CORNER_RADIUS }
    )
    const { ref: tagRef, style: tagStyle } = useSquircleClipPath<HTMLDivElement>(
      { cornerRadius: PLUGGED_TAG_CORNER_RADIUS }
    )

    const selectedModel = MODEL_OPTIONS.find((o) => o.value === model)!
    const selectedAccount = ACCOUNT_OPTIONS.find((o) => o.value === account)!

    const hasCalendarSelection =
      cadence === "daily"
        ? dateSelectMethod === "range"
          ? !!dailyRange.from && !!dailyRange.to
          : dailyDates.length > 0
        : selectedMonths.length > 0

    const scheduledCount =
      mode === "number"
        ? count
        : cadence === "daily"
          ? dateSelectMethod === "range"
            ? dailyRange.from && dailyRange.to
              ? countDaysInclusive(dailyRange.from, dailyRange.to)
              : 0
            : dailyDates.length
          : selectedMonths.reduce((sum, { year, month }) => {
            const total = daysInMonth(year, month)
            if (!skipDatesEnabled) return sum + total
            const skipped = skippedDates.filter(
              (d) => d.getFullYear() === year && d.getMonth() === month
            ).length
            return sum + (total - skipped)
          }, 0)

    const handleToggleMonth = (selection: MonthSelection) => {
      setSelectedMonths((prev) => {
        const isSelected = prev.some(
          (s) => s.year === selection.year && s.month === selection.month
        )
        const next = isSelected
          ? prev.filter(
            (s) => !(s.year === selection.year && s.month === selection.month)
          )
          : [...prev, selection]
        // Kept chronological regardless of click order — appending on select
        // meant the skip-dates carousel (and anything else reading this list)
        // showed calendars in whatever order the user happened to click them
        // in, not calendar order.
        return next.sort((a, b) => a.year - b.year || a.month - b.month)
      })
    }

    const handleToggleSkipDate = (date: Date, skip: boolean) => {
      setSkippedDates((prev) =>
        skip
          ? [...prev, date]
          : prev.filter((d) => !isSameDay(d, date))
      )
    }

    React.useImperativeHandle(ref, () => ({
      resetCalendar: () => {
        setCount(MIN_POSTS)
        setCadence("daily")
        setDateSelectMethod("pick")
        setDailyRange({ from: undefined, to: undefined })
        // Calendar-based has no MIN_POSTS floor — an empty selection is a
        // valid, expected post-reset state, so scheduled posts reads 0.
        setDailyDates([])
        setMonthYear(new Date().getFullYear())
        setSelectedMonths([])
        setSkipDatesEnabled(false)
        setSkippedDates([])
        setShowError(false)
      },
    }))

    const handleGenerateClick = () => {
      if (mode === "calendar" && !hasCalendarSelection) {
        setShowError(true)
        return
      }
      // Generation itself isn't wired up yet — this just transitions to the
      // "Generating…" screen (design-sync/generate-generating-template) so
      // its animations can be built out against the real navigation flow.
      startNavigateToGenerating(() => {
        router.push(
          `/projects/${projectId}/generate/generating?count=${scheduledCount}`
        )
      })
    }

    // Split so calendar-based can slot the "="/ScheduledPostsBar between the
    // pills and the button (per the corrected export) while number-based
    // keeps rendering both pieces back to back, unchanged.
    const modelPills = (
      <div className="flex items-center gap-dist-md">
        <SelectPill
          options={MODEL_OPTIONS}
          value={model}
          onChange={setModel}
          ariaLabel="AI model"
        >
          <span className="text-text-subtle">Using</span>
          <span className="text-text-bold">{selectedModel.label}</span>
          {/* Same rotate-on-open caret as the account pill, per direct
            feedback — was a pencil, which read as "edit" rather than
            "open this dropdown". */}
          <CaretDown className="size-4 text-icon-subtle transition-transform duration-150 ease-out group-aria-expanded/select-pill:rotate-180" />
        </SelectPill>
        <SelectPill
          options={ACCOUNT_OPTIONS}
          value={account}
          onChange={setAccount}
          ariaLabel="Social account"
        >
          {selectedAccount.icon}
          <span className="text-text-bold">{selectedAccount.label}</span>
          {/* Points up while the menu is open — rotated rather than
            icon-swapped so the flip animates. */}
          <CaretDown className="size-4 text-icon-subtle transition-transform duration-150 ease-out group-aria-expanded/select-pill:rotate-180" />
        </SelectPill>
      </div>
    )

    // Split so calendar-based can pair the button tightly with the
    // ScheduledPostsBar (dist-sm, per the "Layout change" export) while the
    // footer stays on the outer dist-xl rhythm in both modes.
    const generateButton = (
      <Button
        variant="brand"
        size="xl"
        className="w-full"
        onClick={handleGenerateClick}
        disabled={isNavigatingToGenerating}
      >
        <MagicWand weight="fill" />
        {/* Both singular and plural literally appear across the Figma
          exports at different counts, inconsistently — plain English
          pluralization is the more defensible rule to code to. One string
          (not two adjacent children) so Button's flex gap doesn't insert a
          space of its own between "Generate" and "Post"/"Posts", and so the
          two render as a single TextMorph unit — only the "s" diffs.
          isNavigatingToGenerating (true for however long the /generating
          route takes to actually load, per the useTransition above) swaps
          this to "Generating" so the button doesn't just sit there looking
          unclicked for that gap. */}
        {isNavigatingToGenerating
          ? "Generating..."
          : `Generate ${scheduledCount > 1 ? "posts" : "post"}`}
      </Button>
    )

    const pluggedInFooter = (
      <div className="flex flex-col items-center">
        <PlugCharging className="size-5 text-icon-subtle" />
        {/* The negative margin tucks the line under the plug glyph's
          built-in inset so the two visually connect; bg-icon-subtle is
          the same value the icon renders in, so they can't drift. */}
        <span
          aria-hidden
          className="-mt-dist-xs h-4 w-[length:var(--stroke-md)] bg-icon-subtle"
        />
        <div
          ref={tagRef}
          style={tagStyle}
          className="rounded-rad-md border-[length:var(--stroke-md)] border-gray-500 bg-surface-4 px-pad-md py-pad-2xs text-body-md text-text-subtle"
        >
          Instructions plugged in
        </div>
      </div>
    )

    return (
      <div className="mx-auto flex w-230 max-w-full flex-col items-center gap-dist-xl p-pad-2xl transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
        <h1 className="text-heading-md font-display text-text-bold">Generate</h1>

        <div className="flex w-full flex-col items-center gap-dist-md">
          <SegmentedControl
            className="w-82"
            value={mode}
            onValueChange={(value) => setMode(value as string)}
            items={[
              { label: "Number-based", value: "number" },
              { label: "Calendar-based", value: "calendar" },
            ]}
          />
          <p className="flex items-center gap-dist-md text-body-md text-text-subtle">
            {mode === "number"
              ? "Generate posts by setting an amount"
              : "Set dates you want to post on a calendar"}
          </p>
        </div>

        {mode === "number" ? (
          <div className="flex w-110 max-w-full flex-col items-center gap-dist-xl">
            <p className="text-center text-body-lg-bold text-text-bold">
              How many posts do you want to generate?
            </p>

            <div
              ref={boxRef}
              style={boxStyle}
              className="flex w-full flex-col items-center gap-dist-md rounded-rad-lg bg-surface-3 py-pad-md"
            >
              <NumberStepper
                value={count}
                onChange={setCount}
                min={MIN_POSTS}
                max={MAX_POSTS}
              />
            </div>

            {modelPills}
            {generateButton}
            {pluggedInFooter}
          </div>
        ) : (
          <div className="flex w-full items-start gap-dist-5xl">
            <div className="flex w-110 max-w-full shrink-0 flex-col items-center gap-dist-xl">
              {/* dist-lg — this trio (cadence, date-select, model/account
                pills) groups tighter than the outer dist-xl rhythm, per the
                "Layout change" export (design-sync/genrate-calendar-based-
                layout-layout-change): Frame 2147239403 nests all three at
                gap 16, distinct from the 24px gap around it. */}
              <div className="flex w-full flex-col items-center gap-dist-lg">
                <RadioCardGroup
                  label="Posting cadence"
                  options={CADENCE_OPTIONS}
                  value={cadence}
                  onValueChange={(value) =>
                    setCadence(value as "daily" | "monthly")
                  }
                />
                {cadence === "daily" ? (
                  <RadioCardGroup
                    label="How do you want to select dates?"
                    options={DATE_SELECT_OPTIONS}
                    value={dateSelectMethod}
                    onValueChange={(value) =>
                      setDateSelectMethod(value as "range" | "pick")
                    }
                  />
                ) : null}

                {/* self-start: the group above centers via items-center (for
                  the two full-width cards, which stretch edge to edge
                  regardless), but the pills row is intrinsically sized —
                  left it centered instead of flush with the cards' left
                  edge, per the "Layout change" export (Frame 2147239357
                  sits at the same x as the cards, x=0 within their shared
                  parent, not centered). */}
                <div className="self-start">{modelPills}</div>
              </div>

              <Equals className="size-5 text-icon-minimal" weight="bold" />

              {/* dist-sm — the count bar and button pair tightly (Frame
                2147239404, gap 8), also distinct from the outer dist-xl. */}
              <div className="flex w-full flex-col items-center gap-dist-lg">
                <ScheduledPostsBar count={scheduledCount} />
                {generateButton}
              </div>

              {pluggedInFooter}
            </div>

            <GenerateCalendarColumn
              cadence={cadence}
              dateSelectMethod={dateSelectMethod}
              dailyRange={dailyRange}
              onDailyRangeChange={(range) => {
                setDailyRange(range)
                setShowError(false)
              }}
              dailyDates={dailyDates}
              onDailyDatesChange={(dates) => {
                setDailyDates(dates)
                setShowError(false)
              }}
              monthYear={monthYear}
              onMonthYearChange={setMonthYear}
              selectedMonths={selectedMonths}
              onToggleMonth={(selection) => {
                handleToggleMonth(selection)
                setShowError(false)
              }}
              skipDatesEnabled={skipDatesEnabled}
              onSkipDatesEnabledChange={setSkipDatesEnabled}
              skippedDates={skippedDates}
              onToggleSkipDate={handleToggleSkipDate}
              showError={showError && !hasCalendarSelection}
            />
          </div>
        )}
      </div>
    )
  }
)
