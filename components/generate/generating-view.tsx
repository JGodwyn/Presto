"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useDialKit } from "dialkit"
import { ArrowClockwise, Info, Play, StopCircle, X } from "@phosphor-icons/react"

import { AnimateText } from "@/components/ui/animated-text"
import { Button } from "@/components/ui/button"
import { GeneratedPostCard } from "@/components/generate/generated-post-card"
import { GeneratingPostCard } from "@/components/generate/generating-post-card"

// Placeholder pace for finishing one post at a time (no real generation job
// to time this against yet) — see the reveal effect below.
const CARD_REVEAL_MS = 1200

// Built from the Figma "Generate / Generating template" export
// (design-sync/generate-generating-template). UI + navigation only — real
// generation isn't wired up yet, so every card renders the same loading
// placeholder regardless of status. Stop/Resume/Restart toggle in place;
// Close (only shown once stopped or completed) is what actually leaves for
// the settings screen. Deliberately its own page (not folded into
// GenerateCard) so the transition and this state's animations can be
// iterated on independently.
export function GeneratingView({
  backHref,
  count,
}: {
  backHref: string
  count: number
}) {
  const router = useRouter()
  // The heading loops and cards keep revealing only while status is
  // "generating"; Close is the only way off this page (it navigates away,
  // unmounting everything, which is what actually stops every animation —
  // see AnimateText's loop effect cleanup).
  const [status, setStatus] = React.useState<
    "generating" | "stopped" | "completed"
  >("generating")
  // How many of the `count` posts have finished so far — each one that
  // finishes turns from a GeneratingPostCard into a GeneratedPostCard, and
  // (while under count) the next GeneratingPostCard takes its place as the
  // one active card. Starts at 0 and ticks up one at a time below, standing
  // in for real per-post completion events until generation is wired up.
  const [generatedCount, setGeneratedCount] = React.useState(0)

  // Finishes the active card every CARD_REVEAL_MS while generating, pausing
  // automatically whenever status leaves "generating" (Stop clears the
  // scheduled completion via this effect's own cleanup — combined with the
  // active card not rendering at all while stopped, below, this is what
  // makes Stop read as "fully paused" rather than just visually frozen).
  React.useEffect(() => {
    if (status !== "generating" || generatedCount >= count) return
    const id = setTimeout(
      () => setGeneratedCount((c) => c + 1),
      CARD_REVEAL_MS
    )
    return () => clearTimeout(id)
  }, [status, generatedCount, count])

  // Separate from the effect above: once every post has finished, the batch
  // is done — this is the other place real generation completion should
  // hook in later, the same way handleStop already models "stopped".
  React.useEffect(() => {
    if (
      status === "generating" &&
      generatedCount > 0 &&
      generatedCount >= count
    ) {
      setStatus("completed")
    }
  }, [status, generatedCount, count])

  const handleStop = () => setStatus("stopped")
  // Resume (from "stopped") continues from wherever it left off; Restart
  // (from "completed") starts the whole batch over from zero — same status
  // transition, different starting point for the count.
  const handleResume = () => setStatus("generating")
  const handleRestart = () => {
    setGeneratedCount(0)
    setStatus("generating")
  }
  const goBack = () => router.push(backHref)

  // Live-tunable via the DialKit panel (top-right, dev only) instead of
  // hand-editing values and reloading — same pattern as the calendar's
  // "Error shake" dial (generate-calendar-column.tsx).
  const headingDial = useDialKit("Generating heading (elastic)", {
    offset: [5, 0, 150, 5],
    stagger: [0.03, 0, 0.15, 0.005],
    duration: [0.3, 0.1, 1.5, 0.05],
    bounce: [0.4, 0, 1, 0.05],
    loopDelay: [800, 300, 4000, 100],
  })

  // A second, separate panel (DialKit supports any number of named panels
  // on one page) for everything on each placeholder card itself — grouped
  // into "text"/"border" folders (a nested object becomes a collapsible
  // folder) since both animate independently. rotationEnabled is a plain
  // boolean, which DialKit renders as a toggle rather than a slider.
  const cardDial = useDialKit("Generating card", {
    text: {
      opacityMin: [0.4, 0, 1, 0.05],
      opacityDuration: [0.5, 0.2, 4, 0.05],
    },
    border: {
      rotationEnabled: true,
      rotationDuration: [0.8, 0.2, 10, 0.1],
      opacityMin: [0.25, 0, 1, 0.05],
      opacityDuration: [0.35, 0.2, 4, 0.05],
    },
  })

  return (
    <div className="flex w-full flex-col gap-dist-xl transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      <div className="flex w-full flex-col gap-dist-md">
        <div className="flex w-full items-center justify-between">
          {/* Trying out nyxui.com's "elastic" AnimateText effect
            (components/ui/animated-text.tsx) on this heading specifically
            — a spot for tweaking animations, per the reason this page
            exists as its own route. Loops (hold → reset → re-enter) only
            while status is "generating". */}
          <AnimateText
            text={
              status === "completed"
                ? `here's ${count} ${count === 1 ? "post" : "posts"} for you`
                : `generating ${count} ${count === 1 ? "post" : "posts"} . . .`
            }
            type="elastic"
            className="text-heading-sm font-display text-text-bold"
            offset={headingDial.offset}
            stagger={headingDial.stagger}
            duration={headingDial.duration}
            bounce={headingDial.bounce}
            loop={status === "generating"}
            loopDelay={headingDial.loopDelay}
          />

          <div className="flex items-center gap-dist-md">
            {status === "generating" ? (
              <Button variant="danger" size="sm" onClick={handleStop}>
                <StopCircle weight="bold" />
                Stop
              </Button>
            ) : (
              <Button
                variant={status === "stopped" ? "success" : "brand"}
                size="sm"
                onClick={status === "stopped" ? handleResume : handleRestart}
              >
                {/* Two top-level children (not one wrapped in a fragment)
                  so Button's per-child TextMorph — see button.tsx's
                  withTextMorph — still animates the label the same way
                  "Stop"/"Generate post(s)" already do elsewhere. */}
                {status === "stopped" ? (
                  <Play weight="bold" />
                ) : (
                  <ArrowClockwise weight="bold" />
                )}
                {status === "stopped" ? "Resume" : "Restart"}
              </Button>
            )}

            {/* Hidden while generating — only a stopped or completed batch
              has anything to walk away from. */}
            {status !== "generating" && (
              <Button
                variant="brand-secondary"
                size="icon-sm"
                aria-label="Close"
                onClick={goBack}
              >
                <X weight="bold" />
              </Button>
            )}
          </div>
        </div>

        <p className="flex items-center gap-dist-md text-body-md text-text-subtle">
          <Info className="size-4 text-icon-subtle" />
          Double-tap to edit posts
        </p>
      </div>

      {/* Fluid grid, same technique as the /projects folder grid
        (app/projects/page.tsx): fit as many ≥17.5rem (280px, the card's own
        width) columns as the viewport allows, then stretch them equally to
        fill the row — a fixed-width flex-wrap row left whatever didn't
        divide evenly as dead space on the right once the browser was
        maximized. auto-fill keeps empty tracks so a partial row (or a
        single generating card) still lands left-aligned instead of
        stretching alone to fill the whole row. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] content-start gap-dist-md p-pad-xs">
        {/* Each card mounts with the same blur+opacity entrance used
          elsewhere in the app (e.g. this page's own outer wrapper above)
          rather than just popping in. */}
        {Array.from({ length: generatedCount }, (_, i) => (
          <div
            key={i}
            className="transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]"
          >
            <GeneratedPostCard />
          </div>
        ))}

        {/* The one active card — hidden while stopped (not just paused in
          place), and naturally absent once generatedCount reaches count
          (nothing left to generate). Keyed on generatedCount so the next
          post after this one gets a genuinely fresh instance (own mount
          time, own animations) rather than reusing this one's — pausing/
          resuming within the same post doesn't change generatedCount, so
          it doesn't remount for that. */}
        {status !== "stopped" && generatedCount < count && (
          <div
            key={generatedCount}
            className="transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]"
          >
            <GeneratingPostCard
              textOpacityMin={cardDial.text.opacityMin}
              textOpacityDuration={cardDial.text.opacityDuration}
              rotationEnabled={cardDial.border.rotationEnabled}
              rotationDuration={cardDial.border.rotationDuration}
              borderOpacityMin={cardDial.border.opacityMin}
              borderOpacityDuration={cardDial.border.opacityDuration}
            />
          </div>
        )}
      </div>
    </div>
  )
}
