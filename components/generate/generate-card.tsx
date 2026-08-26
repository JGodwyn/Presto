"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  CaretDown,
  Equals,
  MagicWand,
  PlugCharging,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { type DateRange } from "@/components/ui/calendar"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  buildAccountOptions,
  TRY_OUT_ACCOUNT_ID,
} from "@/components/generate/account-options"
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
import { BUILTIN_MODEL_ID, TASTE_TEST_MODEL_ID } from "@/lib/ai/generate"
import { generateSettingsStorageKey } from "@/lib/generate-settings"
import { fetchSocialAccounts, fetchUserAiModels } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/client"
import { withNetworkStatus } from "@/lib/network-status"
import {
  clearScheduledDates,
  writeScheduledDates,
} from "@/lib/generate-schedule"
import type { PostPlatform } from "@/types/post"

// Figma radii as px for the squircle path math: the surface-3 stepper box
// (--rad-lg) and the "Instructions plugged in" tag (--rad-md).
const STEPPER_BOX_CORNER_RADIUS = 16
const PLUGGED_TAG_CORNER_RADIUS = 8

// Half the app's usual 600ms tooltip delay, per direct request — these two
// name what a control is for rather than adding detail to something already
// legible, so they should arrive while the pointer is still on the pill.
const PILL_TOOLTIP_DELAY_MS = 300

// 1–31: up to a full month of dailies (raised from the UX doc §8.2's 20 per
// direct feedback).
const MIN_POSTS = 1
const MAX_POSTS = 31

// The two models that need no setup: the app's own Gemini key, and TasteTest
// (lib/ai/taste-test.ts), a free stand-in that skips the real model call and
// returns canned content instead, purely so the Generate flow can be tested
// repeatedly without spending free-tier quota. Values are kept in sync by
// hand with lib/ai/generate.ts's BUILTIN_MODELS. Anything the user has added
// on the Connections page is appended to these at runtime (see the fetch
// below) — a user model's `value` is its user_ai_models row id.
const BUILTIN_MODEL_OPTIONS: SelectPillOption[] = [
  { value: BUILTIN_MODEL_ID, label: "Gemini 3.6 Flash" },
  { value: TASTE_TEST_MODEL_ID, label: "TasteTest" },
]

const CADENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
]

const DATE_SELECT_OPTIONS = [
  { value: "range", label: "Date range" },
  { value: "pick", label: "Pick dates" },
]

// Persisted per-project (colon-delimited "presto:" namespace, same convention
// as components/onboarding/onboarding-context.tsx) so leaving the Generate
// tab and coming back doesn't reset the form — everything below, including
// the actual date/month selections, round-trips through localStorage.
// Dates are stored as plain "YYYY-MM-DD" strings (serializeDate/
// deserializeDate below) built from local getFullYear/getMonth/getDate,
// never toISOString/Date parsing — those go through UTC, which can shift a
// local-midnight date across a day boundary depending on the browser's
// timezone, silently restoring the wrong day.
interface StoredGenerateSettings {
  mode: string
  count: number
  model: string
  account: string
  cadence: "daily" | "monthly"
  dateSelectMethod: "range" | "pick"
  skipDatesEnabled: boolean
  dailyRangeFrom?: string
  dailyRangeTo?: string
  dailyDates: string[]
  monthYear: number
  selectedMonths: MonthSelection[]
  skippedDates: string[]
}

function serializeDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function deserializeDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function deserializeDates(values: unknown): Date[] {
  if (!Array.isArray(values)) return []
  return values
    .filter((value): value is string => typeof value === "string")
    .map(deserializeDate)
    .filter((date): date is Date => date !== undefined)
}

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
    const [model, setModel] = React.useState(BUILTIN_MODEL_OPTIONS[0].value)
    // Models the user added on the Connections page. Fetched here with the
    // browser client rather than passed down as a prop because this card's
    // page is a client component (it holds the reset-calendar ref) and so
    // can't fetch on the server — lib/supabase/queries.ts's contract
    // explicitly accepts either client, and RLS scopes the read either way.
    // The built-ins render immediately; these append when they arrive.
    const [userModelOptions, setUserModelOptions] = React.useState<
      SelectPillOption[]
    >([])
    // Tracked separately from the list being empty: "no models yet" and "no
    // models because we haven't asked" need to be told apart by the
    // stale-selection repair below, and deleting your only model produces the
    // former while looking exactly like the latter.
    const [userModelsLoaded, setUserModelsLoaded] = React.useState(false)

    React.useEffect(() => {
      let cancelled = false

      void withNetworkStatus(fetchUserAiModels(createClient()))
        .then((models) => {
          if (models === null) return
          if (cancelled) return
          setUserModelOptions(
            models.map((userModel) => ({
              value: userModel.id,
              label: userModel.label,
            }))
          )
          setUserModelsLoaded(true)
        })
        .catch(() => {
          // Non-fatal: the built-ins are still selectable, and Connections is
          // where a broken model list would actually get diagnosed. Left
          // unloaded on purpose — a failed fetch is no evidence that a
          // persisted model id is stale, so nothing should be reset.
          // (A connectivity failure never reaches here — withNetworkStatus
          // turns it into a null result and raises the toast instead.)
        })

      return () => {
        cancelled = true
      }
    }, [])

    const modelOptions = React.useMemo(
      () => [...BUILTIN_MODEL_OPTIONS, ...userModelOptions],
      [userModelOptions]
    )
    // "Try out" is the resting default, and deliberately so: generation
    // needs no social account at all (nothing is ever published — see
    // AGENTS.md's publishing constraint), and the common case today is a
    // project with nothing connected. Defaulting to a platform would put a
    // greyed-out, unpickable account in the pill on a fresh project.
    const [account, setAccount] = React.useState<string>(TRY_OUT_ACCOUNT_ID)
    // Which platforms this project has actually connected on Connections —
    // everything else in the menu renders greyed out. Fetched with the
    // browser client for the same reason as the models above.
    const [connectedPlatforms, setConnectedPlatforms] = React.useState<
      PostPlatform[]
    >([])
    // Same distinction as userModelsLoaded: "nothing connected" and "we
    // haven't asked yet" look identical in an empty list, and only the first
    // of them justifies resetting a persisted account.
    const [socialAccountsLoaded, setSocialAccountsLoaded] =
      React.useState(false)

    React.useEffect(() => {
      let cancelled = false

      void withNetworkStatus(fetchSocialAccounts(createClient(), projectId))
        .then((accounts) => {
          if (accounts === null) return
          if (cancelled) return
          setConnectedPlatforms(accounts.map((a) => a.platform))
          setSocialAccountsLoaded(true)
        })
        .catch(() => {
          // Non-fatal, same as the model fetch: "Try out" is always
          // selectable, so a failed read costs the user nothing but the
          // real accounts, and left unloaded on purpose so a persisted
          // account isn't reset on no evidence.
        })

      return () => {
        cancelled = true
      }
    }, [projectId])

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

    const storageKey = generateSettingsStorageKey(projectId)
    // Gates the write effect below until the read has had its chance to run
    // — without this, the write effect's first pass (which fires on mount
    // like any other effect) would write the fresh defaults over whatever
    // was saved before the read's setState calls land.
    const [hasHydratedSettings, setHasHydratedSettings] = React.useState(false)

    React.useEffect(() => {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<StoredGenerateSettings>
          if (saved.mode) setMode(saved.mode)
          if (typeof saved.count === "number") setCount(saved.count)
          if (saved.model) setModel(saved.model)
          if (saved.account) setAccount(saved.account)
          if (saved.cadence) setCadence(saved.cadence)
          if (saved.dateSelectMethod) setDateSelectMethod(saved.dateSelectMethod)
          if (typeof saved.skipDatesEnabled === "boolean")
            setSkipDatesEnabled(saved.skipDatesEnabled)
          if (saved.dailyRangeFrom || saved.dailyRangeTo) {
            setDailyRange({
              from: saved.dailyRangeFrom
                ? deserializeDate(saved.dailyRangeFrom)
                : undefined,
              to: saved.dailyRangeTo ? deserializeDate(saved.dailyRangeTo) : undefined,
            })
          }
          if (saved.dailyDates) setDailyDates(deserializeDates(saved.dailyDates))
          if (typeof saved.monthYear === "number") setMonthYear(saved.monthYear)
          if (Array.isArray(saved.selectedMonths))
            setSelectedMonths(saved.selectedMonths)
          if (saved.skippedDates) setSkippedDates(deserializeDates(saved.skippedDates))
        } catch {
          // Corrupted or old-shape value — ignore it, defaults stand.
        }
      }
      setHasHydratedSettings(true)
    }, [storageKey])

    React.useEffect(() => {
      if (!hasHydratedSettings) return
      const toStore: StoredGenerateSettings = {
        mode,
        count,
        model,
        account,
        cadence,
        dateSelectMethod,
        skipDatesEnabled,
        dailyRangeFrom: dailyRange.from ? serializeDate(dailyRange.from) : undefined,
        dailyRangeTo: dailyRange.to ? serializeDate(dailyRange.to) : undefined,
        dailyDates: dailyDates.map(serializeDate),
        monthYear,
        selectedMonths,
        skippedDates: skippedDates.map(serializeDate),
      }
      window.localStorage.setItem(storageKey, JSON.stringify(toStore))
    }, [
      hasHydratedSettings,
      storageKey,
      mode,
      count,
      model,
      account,
      cadence,
      dateSelectMethod,
      skipDatesEnabled,
      dailyRange,
      dailyDates,
      monthYear,
      selectedMonths,
      skippedDates,
    ])

    const { ref: boxRef, style: boxStyle } = useSquircleClipPath<HTMLDivElement>(
      { cornerRadius: STEPPER_BOX_CORNER_RADIUS }
    )
    const { ref: tagRef, style: tagStyle } = useSquircleClipPath<HTMLDivElement>(
      { cornerRadius: PLUGGED_TAG_CORNER_RADIUS }
    )

    // No non-null assertion here: `model` is restored from localStorage
    // without validation, and a user model deleted on Connections since the
    // last visit leaves an id that matches nothing. Falling back to the
    // built-in keeps the pill rendering; the effect below repairs the state
    // itself so the stale id can't also be sent to the generate flow.
    const selectedModel =
      modelOptions.find((o) => o.value === model) ?? BUILTIN_MODEL_OPTIONS[0]

    React.useEffect(() => {
      // Gated on the fetch having resolved — before that, every user model id
      // legitimately "matches nothing" and would be reset for no reason.
      if (!userModelsLoaded) return
      if (!modelOptions.some((o) => o.value === model)) {
        setModel(BUILTIN_MODEL_OPTIONS[0].value)
      }
    }, [model, modelOptions, userModelsLoaded])
    const accountOptions = React.useMemo(
      () => buildAccountOptions(connectedPlatforms),
      [connectedPlatforms]
    )

    // No non-null assertion, for the same reason as selectedModel above:
    // `account` is restored from localStorage unvalidated, and an account
    // disconnected since the last visit leaves a value matching nothing here.
    // The fallback is the "Try out" option, which heads the list and can
    // never be unavailable. Deliberately tolerant of a *disabled* match
    // (rather than requiring a selectable one) so the pill doesn't flicker
    // through "Try out" on every load while the fetch below is still out.
    const selectedAccount =
      accountOptions.find((o) => o.value === account) ?? accountOptions[0]

    React.useEffect(() => {
      // Gated on the fetch having resolved — before it does, every platform
      // legitimately reads as unconnected.
      if (!socialAccountsLoaded) return
      if (accountOptions.some((o) => o.value === account && !o.disabled)) return
      setAccount(TRY_OUT_ACCOUNT_ID)
    }, [account, accountOptions, socialAccountsLoaded])

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

    // Same shape as scheduledCount above, just the actual dates instead of
    // a length — this is what lets a calendar-based batch's posts land
    // scheduled (design-sync/ChangesToGenerateCard) instead of every post
    // defaulting to a draft. null for number-based, which has no dates to
    // assign at all.
    const scheduledDates = React.useMemo(() => {
      if (mode !== "calendar") return null
      if (cadence === "daily") {
        if (dateSelectMethod === "range") {
          if (!dailyRange.from || !dailyRange.to) return []
          const dates: Date[] = []
          const cursor = new Date(
            dailyRange.from.getFullYear(),
            dailyRange.from.getMonth(),
            dailyRange.from.getDate()
          )
          const end = dailyRange.to
          while (cursor <= end) {
            dates.push(new Date(cursor))
            cursor.setDate(cursor.getDate() + 1)
          }
          return dates
        }
        return [...dailyDates].sort((a, b) => a.getTime() - b.getTime())
      }
      // Monthly — selectedMonths is already kept chronological (see
      // handleToggleMonth below), so every day this appends stays ordered.
      const dates: Date[] = []
      for (const { year, month } of selectedMonths) {
        const total = daysInMonth(year, month)
        for (let day = 1; day <= total; day++) {
          const date = new Date(year, month, day)
          if (
            skipDatesEnabled &&
            skippedDates.some((skipped) => isSameDay(skipped, date))
          ) {
            continue
          }
          dates.push(date)
        }
      }
      return dates
    }, [
      mode,
      cadence,
      dateSelectMethod,
      dailyRange,
      dailyDates,
      selectedMonths,
      skipDatesEnabled,
      skippedDates,
    ])

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
      // Handed off via sessionStorage (see lib/generate-schedule.ts), not
      // the URL — a calendar-based batch can run to hundreds of dates.
      // Written/cleared unconditionally on every click so a later
      // number-based generate can never pick up a stale calendar selection.
      if (scheduledDates) {
        writeScheduledDates(scheduledDates)
      } else {
        clearScheduledDates()
      }
      // account/model ride in the URL (unlike the dates above) — both are
      // single short values, nowhere near query-string length concerns.
      startNavigateToGenerating(() => {
        router.push(
          `/projects/${projectId}/generate/generating?count=${scheduledCount}&account=${account}&model=${model}`
        )
      })
    }

    // Split so calendar-based can slot the "="/ScheduledPostsBar between the
    // pills and the button (per the corrected export) while number-based
    // keeps rendering both pieces back to back, unchanged.
    const modelPills = (
      // One Provider around both pills rather than one each: Base UI groups
      // tooltips that share a provider, so moving from one pill to the other
      // shows the second immediately instead of waiting the delay out again.
      <TooltipProvider delay={PILL_TOOLTIP_DELAY_MS}>
        <div className="flex items-center gap-dist-md">
          <SelectPill
            options={modelOptions}
            value={model}
            onChange={setModel}
            ariaLabel="AI model"
            tooltip="Model to use"
          >
            <span className="text-text-subtle">Using</span>
            <span className="text-text-bold">{selectedModel.label}</span>
            {/* Same rotate-on-open caret as the account pill, per direct
              feedback — was a pencil, which read as "edit" rather than
              "open this dropdown". */}
            <CaretDown className="size-4 text-icon-subtle transition-transform duration-150 ease-out group-aria-expanded/select-pill:rotate-180" />
          </SelectPill>
          <SelectPill
            options={accountOptions}
            value={account}
            onChange={setAccount}
            ariaLabel="Social account"
            tooltip="Socials to generate for"
          >
            {selectedAccount.triggerIcon}
            <span className="text-text-bold">{selectedAccount.label}</span>
            {/* Points up while the menu is open — rotated rather than
              icon-swapped so the flip animates. */}
            <CaretDown className="size-4 text-icon-subtle transition-transform duration-150 ease-out group-aria-expanded/select-pill:rotate-180" />
          </SelectPill>
        </div>
      </TooltipProvider>
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
            {/* The question and the stepper it asks about are one group at
              dist-lg (16px), tighter than the dist-xl rhythm around it — per
              direct request to cut 8px from this gap specifically. A nested
              wrapper rather than a cancelling negative margin, so the value
              stays a real token. */}
            <div className="flex w-full flex-col items-center gap-dist-lg">
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
