"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useDialKit } from "dialkit"
import {
  ArrowClockwise,
  Info,
  Pause,
  Play,
  SpinnerGap,
  StopCircle,
  X,
} from "@phosphor-icons/react"

import { AnimateText } from "@/components/ui/animated-text"
import { Button } from "@/components/ui/button"
import { GeneratedPostCard } from "@/components/generate/generated-post-card"
import { GeneratingPostCard } from "@/components/generate/generating-post-card"
import { useFlipReorder } from "@/hooks/use-flip-reorder"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"

// Figma --rad-md as px for the squircle path math (the status pill).
const STATUS_PILL_CORNER_RADIUS = 8

// Placeholder pace for finishing one post at a time (no real generation job
// to time this against yet) — see the reveal effect below.
const CARD_REVEAL_MS = 1200

// Matches the delete exit animation's own duration-300 below (kept in sync
// by hand, same convention as the skip-dates carousel's EXIT_ANIMATION_MS) —
// the extra buffer is slack for the fallback timer, not part of the visible
// animation.
const DELETE_EXIT_MS = 300
const DELETE_FALLBACK_BUFFER_MS = 50

// Every post that's finished generating and is still on screen (not
// deleted). Content/topics are still placeholders (see GeneratedPostCard) —
// date is the one real, per-post piece of state so "Add to calendar" has
// somewhere to write its pick. undefined = draft (design-sync/
// ChangesToGenerateCard) — every freshly-generated post starts here; a
// number-based batch has no date to assign at all, and even a calendar-based
// one isn't wired to hand specific per-post dates through to this page yet,
// so both currently land the same way. "Add to calendar"/"Change date"
// (GeneratedPostCard) is what turns a post scheduled.
interface GeneratedPost {
  id: number
  date: Date | undefined
}

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
  // How many of the `count` posts have finished so far — drives the reveal
  // pacing and the "batch complete" check below, same role the old plain
  // `generatedCount` number played. Kept separate from `posts` (below)
  // because deleting a finished post shouldn't make the pacing effect think
  // fewer posts have been generated than actually have — it only ever
  // increases, once per post, regardless of what happens to that post
  // afterward.
  const [generatedSoFar, setGeneratedSoFar] = React.useState(0)
  // Every generated post still on screen — id is a stable identity for
  // delete/regenerate/date-change to target one specific card independent of
  // its position (posts never reorder, but this is the same reasoning as
  // keying list items on id rather than index).
  const [posts, setPosts] = React.useState<GeneratedPost[]>([])
  const nextPostId = React.useRef(0)
  // Delete plays an exit animation (reversing the card's own entrance)
  // before actually leaving `posts` — this tracks which ids are mid-exit, so
  // the header's own count (below) can drop the instant delete is clicked
  // rather than waiting for the animation to finish, while the card itself
  // stays rendered (with the reversed classes) until then. Same
  // animate-before-remove shape as the skip-dates carousel's
  // useCarouselPresence (generate-calendar-column.tsx), scoped down to a
  // single Set since there's no reordering to also account for here.
  const [exitingPostIds, setExitingPostIds] = React.useState<Set<number>>(
    new Set()
  )
  const deleteFallbackTimeouts = React.useRef(
    new Map<number, ReturnType<typeof setTimeout>>()
  )

  const finishDeletePost = React.useCallback((id: number) => {
    const timeout = deleteFallbackTimeouts.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      deleteFallbackTimeouts.current.delete(id)
    }
    setPosts((prev) => prev.filter((post) => post.id !== id))
    setExitingPostIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const handleDeletePost = (id: number) => {
    setExitingPostIds((prev) => new Set(prev).add(id))
    // Fallback in case onTransitionEnd never fires (e.g. the tab is
    // backgrounded mid-fade, which suspends transitions and their events) —
    // same reasoning as the carousel's own fallback timer.
    const timeout = setTimeout(
      () => finishDeletePost(id),
      DELETE_EXIT_MS + DELETE_FALLBACK_BUFFER_MS
    )
    deleteFallbackTimeouts.current.set(id, timeout)
  }

  const handlePostDateChange = (id: number, date: Date) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === id ? { ...post, date } : post))
    )
  }

  const handleTurnToDraft = (id: number) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === id ? { ...post, date: undefined } : post))
    )
  }

  React.useEffect(() => {
    const timeouts = deleteFallbackTimeouts.current
    return () => {
      timeouts.forEach(clearTimeout)
      timeouts.clear()
    }
  }, [])

  // Finishes the active card every CARD_REVEAL_MS while generating, pausing
  // automatically whenever status leaves "generating" (Stop clears the
  // scheduled completion via this effect's own cleanup — combined with the
  // active card not rendering at all while stopped, below, this is what
  // makes Stop read as "fully paused" rather than just visually frozen).
  React.useEffect(() => {
    if (status !== "generating" || generatedSoFar >= count) return
    const id = setTimeout(() => {
      // Starts as a draft (no date) — "Add to calendar" is what actually
      // schedules it.
      setPosts((prev) => [
        ...prev,
        { id: nextPostId.current++, date: undefined },
      ])
      setGeneratedSoFar((c) => c + 1)
    }, CARD_REVEAL_MS)
    return () => clearTimeout(id)
  }, [status, generatedSoFar, count])

  // Separate from the effect above: once every post has finished, the batch
  // is done — this is the other place real generation completion should
  // hook in later, the same way handleStop already models "stopped".
  React.useEffect(() => {
    if (
      status === "generating" &&
      generatedSoFar > 0 &&
      generatedSoFar >= count
    ) {
      setStatus("completed")
    }
  }, [status, generatedSoFar, count])

  const handleStop = () => setStatus("stopped")
  // Resume (from "stopped") continues from wherever it left off; Restart
  // (from "completed") starts the whole batch over from zero — same status
  // transition, different starting point for the count.
  const handleResume = () => setStatus("generating")
  const handleRestart = () => {
    deleteFallbackTimeouts.current.forEach(clearTimeout)
    deleteFallbackTimeouts.current.clear()
    setGeneratedSoFar(0)
    setPosts([])
    setExitingPostIds(new Set())
    setStatus("generating")
  }
  // Same reasoning as the Generate button's own useTransition
  // (generate-card.tsx): router.push doesn't resolve instantly, so isPending
  // is the signal for that gap — Close swaps to a spinner (the app's
  // standard SpinnerGap-bold-animate-spin loading treatment, e.g.
  // logout-button.tsx) rather than sitting there unresponsive.
  const [isNavigatingBack, startNavigateBack] = React.useTransition()
  const goBack = () => startNavigateBack(() => router.push(backHref))

  // Warms backHref's route ahead of the click, same reasoning as
  // generate-card.tsx's own prefetch of this page — arriving here via a
  // plain Button click (not <Link>) meant the Generate page never got a
  // chance to prefetch ahead of time either.
  React.useEffect(() => {
    router.prefetch(backHref)
  }, [router, backHref])

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

  // Excludes ids mid-delete-exit so the header count drops the instant
  // delete is clicked, not once the fade-out animation finishes.
  const availablePostCount = posts.length - exitingPostIds.size

  // Smoothly closes the gap a deleted card leaves behind — without this,
  // the remaining cards would just snap into their new grid cell the
  // instant `posts` drops the deleted one. Same FLIP hook the skip-dates
  // carousel uses (hooks/use-flip-reorder.ts), just 2D here since this is a
  // multi-column grid (a delete can shift later cards up a row, not just
  // sideways) rather than that carousel's single horizontal row.
  // skipOnGrowth: true — a new post always appends into the grid's next
  // empty cell (confirmed nothing else shifts when that happens), so this
  // only ever needs to correct for a genuine removal, not the reveal timer
  // adding one — without it, the card right before a freshly-revealed one
  // would briefly (and incorrectly) animate as if it had also moved.
  const flipReorder = useFlipReorder(
    posts.map((post) => String(post.id)),
    { skipOnGrowth: true }
  )

  // "N/count" in the status pill next to Stop — the post currently in
  // flight (or, while stopped, whichever one would resume next), not how
  // many have actually finished. Clamped to `count` for the one-render
  // window where generatedSoFar can reach count while status hasn't yet
  // flipped to "completed" (the two effects above run in separate passes).
  const currentPostNumber = Math.min(generatedSoFar + 1, count)
  const { ref: statusPillRef, style: statusPillStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: STATUS_PILL_CORNER_RADIUS,
    })

  return (
    <div className="flex w-full flex-col gap-dist-xl transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      <div className="flex w-full flex-col gap-dist-md">
        <div className="flex w-full items-center justify-between">
          {/* Trying out nyxui.com's "elastic" AnimateText effect
            (components/ui/animated-text.tsx) on this heading specifically
            — a spot for tweaking animations, per the reason this page
            exists as its own route. Loops (hold → reset → re-enter) only
            while status is "generating". Once completed, the count tracks
            however many generated posts are still actually on screen
            (availablePostCount) rather than the original target `count` —
            deleting a post should drop this number, not just remove the
            card. */}
          <AnimateText
            text={
              status === "completed"
                ? `here's ${availablePostCount} ${availablePostCount === 1 ? "post" : "posts"} for you`
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
            {/* design-sync/generatepoststatus — visible while there's still
              something to generate or resume (generating or stopped),
              gone once the batch is actually done. Spinner while
              generating, Pause once stopped (per direct request) — same
              icon slot, swapped rather than two separate elements. */}
            {status !== "completed" && (
              <div
                ref={statusPillRef}
                style={statusPillStyle}
                className="flex items-center gap-dist-sm rounded-rad-md border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 py-pad-xs px-pad-sm"
              >
                {status === "generating" ? (
                  <SpinnerGap
                    weight="bold"
                    className="size-5 animate-spin text-icon-subtle"
                  />
                ) : (
                  <Pause weight="bold" className="size-5 text-icon-subtle" />
                )}
                <span className="text-body-lg text-text-subtle">
                  {currentPostNumber}/{count}
                </span>
              </div>
            )}

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
                disabled={isNavigatingBack}
              >
                {isNavigatingBack ? (
                  <SpinnerGap weight="bold" className="animate-spin" />
                ) : (
                  <X weight="bold" />
                )}
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
        {/* Each finished card mounts with the app's usual blur+opacity
          entrance, plus a subtle scale-in (0.9 → 1, the same mount-in floor
          used elsewhere — e.g. the skip-dates carousel's per-item enter in
          generate-calendar-column.tsx) rather than just popping in at full
          size. Deleting reverses those exact same classes in place (see
          exitingPostIds above) before the card actually leaves `posts` —
          onTransitionEnd is guarded to the wrapper itself so a transition
          bubbling up from inside the card (e.g. a button hover) can't
          trigger it early. flipReorder.register smoothly closes the gap
          this leaves in the grid for whichever cards shift into it, rather
          than them snapping straight to their new cell. */}
        {posts.map((post) => {
          const exiting = exitingPostIds.has(post.id)
          return (
            <div
              key={post.id}
              ref={flipReorder.register(String(post.id))}
              className={cn(
                "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-90 starting:opacity-0 starting:blur-[8px]",
                exiting && "scale-90 opacity-0 blur-[8px]"
              )}
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget && exiting) {
                  finishDeletePost(post.id)
                }
              }}
            >
              <GeneratedPostCard
                date={post.date}
                onDateChange={(date) => handlePostDateChange(post.id, date)}
                onDelete={() => handleDeletePost(post.id)}
                onTurnToDraft={() => handleTurnToDraft(post.id)}
                textOpacityMin={cardDial.text.opacityMin}
                textOpacityDuration={cardDial.text.opacityDuration}
                rotationEnabled={cardDial.border.rotationEnabled}
                rotationDuration={cardDial.border.rotationDuration}
                borderOpacityMin={cardDial.border.opacityMin}
                borderOpacityDuration={cardDial.border.opacityDuration}
              />
            </div>
          )
        })}

        {/* The one active card — hidden while stopped (not just paused in
          place), and naturally absent once generatedSoFar reaches count
          (nothing left to generate). Keyed on generatedSoFar so the next
          post after this one gets a genuinely fresh instance (own mount
          time, own animations) rather than reusing this one's — pausing/
          resuming within the same post doesn't change generatedSoFar, so
          it doesn't remount for that. */}
        {status !== "stopped" && generatedSoFar < count && (
          <div
            key={generatedSoFar}
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
