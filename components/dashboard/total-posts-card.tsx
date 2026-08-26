"use client"

import NumberFlow from "@number-flow/react"
import { CalendarDots, Queue, Scribble } from "@phosphor-icons/react"

import type { PostTotals } from "@/lib/dashboard-summary"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DashboardCard } from "@/components/dashboard/dashboard-card"
import { MiniStatCard } from "@/components/dashboard/stat-cards"

// Stadium shapes use `rounded-full`, never `rounded-rad-rd`: --rad-rd exists as
// a raw variable but was never mapped into @theme as --radius-rad-rd, so that
// class generates nothing and silently computes to 0px. toast.tsx made the same
// swap for the same reason. See LEARNINGS.

function Legend({ colorClassName, label }: { colorClassName: string; label: string }) {
  return (
    <span className="flex items-center gap-dist-sm">
      <span className={`size-2 shrink-0 rounded-rad-xs ${colorClassName}`} aria-hidden />
      <span className="text-body-md text-text-subtle">{label}</span>
    </span>
  )
}

export function TotalPostsCard({
  totals,
  monthScheduled,
  monthQueued,
  monthPublished,
}: {
  totals: PostTotals
  // "of N this month" — how many posts sit on this month's calendar at all,
  // the denominator the Queued and Published mini cards count against.
  monthScheduled: number
  monthQueued: number
  monthPublished: number
}) {
  const { total, draft, queued, published } = totals
  const share = (count: number) => (total === 0 ? 0 : (count / total) * 100)

  // Two things are being computed here and they are deliberately different.
  //
  // **Paint** is cumulative: the track is the Published colour at full width,
  // Queued is painted over it from the left, and Draft over that. Each painted
  // segment's width is therefore a running total, which is what makes the three
  // read as one continuous stadium instead of three pills with seams — it's how
  // the export draws it.
  //
  // **Hit-testing** is not cumulative: each band owns only its own slice, so
  // hovering the orange stretch reports the queued share and not the total to
  // its left. Overlapping paint can't answer that, hence the separate
  // transparent bands laid over the top.
  const draftPercent = share(draft)
  const queuedPercent = share(queued)
  const publishedPercent = share(published)

  const paintedSegments = [
    { key: "queued", width: draftPercent + queuedPercent, className: "bg-flame-400" },
    { key: "draft", width: draftPercent, className: "bg-flame-700" },
  ]

  const bands = [
    { key: "draft", label: "Draft", start: 0, width: draftPercent, percent: draftPercent },
    {
      key: "queued",
      label: "Queued",
      start: draftPercent,
      width: queuedPercent,
      percent: queuedPercent,
    },
    {
      key: "published",
      label: "Published",
      start: draftPercent + queuedPercent,
      width: publishedPercent,
      percent: publishedPercent,
    },
  ]

  return (
    <DashboardCard className="flex-row items-end gap-dist-xl">
      <div className="flex w-78 shrink-0 flex-col justify-end gap-dist-md">
        <div className="flex flex-col">
          <span className="text-body-lg-bold text-text-subtle">Total posts</span>
          <span className="flex items-center gap-dist-md">
            <CalendarDots weight="bold" className="size-6 shrink-0 text-icon-bold" />
            <NumberFlow
              value={total}
              className="text-heading-lg font-display text-text-bold"
            />
          </span>
        </div>

        <div className="flex flex-col gap-dist-md">
          {/* delay={0}: the percentages are the point of the bar, not a hint
              about it, so waiting to reveal them just makes the bar feel
              unresponsive. */}
          <TooltipProvider delay={0}>
            {/* Fixed-height rail, so the bar growing on hover can't nudge the
                legend below it. It's also the hover target: 16px is a
                comfortable one for an 8px bar, and the bands below fill it. */}
            <div className="group relative flex h-4 items-center">
              <div
                // Height rather than a scaleY transform, which STANDARDS.md
                // would otherwise prefer: scaling a stadium distorts the very
                // radius that gives it its shape. One 8px-tall element on a
                // 150ms ease-out — the app's standard hover/press duration.
                className="relative h-2 w-full rounded-full bg-flame-100 transition-[height] duration-150 ease-out group-hover:h-2.5"
              >
                {paintedSegments.map((segment) => (
                  <div
                    key={segment.key}
                    className={`absolute inset-y-0 left-0 rounded-full ${segment.className}`}
                    style={{ width: `${segment.width}%` }}
                  />
                ))}
              </div>

              {/* Transparent hit areas, one per state, over the painted bar.
                  Each is its own tooltip anchor, so the bubble also lands
                  centred on the slice being hovered rather than on the bar as
                  a whole. A state with no posts gets a zero-width band and is
                  simply unreachable, which is correct — there's nothing to
                  report. */}
              {bands.map((band) => (
                <Tooltip key={band.key}>
                  <TooltipTrigger
                    render={<div />}
                    tabIndex={0}
                    aria-label={`${band.label}: ${Math.round(band.percent)}% of your posts`}
                    className="absolute inset-y-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    style={{ left: `${band.start}%`, width: `${band.width}%` }}
                  />
                  <TooltipContent>
                    {band.label} ({Math.round(band.percent)}%)
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          <div className="flex items-center justify-start gap-dist-md">
            <Legend colorClassName="bg-flame-700" label="Draft" />
            <Legend colorClassName="bg-flame-400" label="Queued" />
            <Legend colorClassName="bg-flame-100" label="Published" />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-dist-md">
        <MiniStatCard
          label="Drafts"
          icon={Scribble}
          value={draft}
          caption="with no dates"
        />
        <MiniStatCard
          label="Queued"
          icon={Queue}
          value={monthQueued}
          caption={`of ${monthScheduled} this month`}
        />
        <MiniStatCard
          label="Published"
          icon={Queue}
          value={monthPublished}
          caption={`of ${monthScheduled} this month`}
        />
      </div>
    </DashboardCard>
  )
}
