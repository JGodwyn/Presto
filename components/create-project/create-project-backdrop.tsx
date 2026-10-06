"use client"

import * as React from "react"

import {
  SIDE_ART_LAYERS,
  SideArt,
  type SideArtLayer,
} from "@/components/create-project/side-art"
import { cn } from "@/lib/utils"

// The /create-project backdrop: the stepped bar art (side-art.tsx) on both
// screen edges, revealed outward on load and pulled back in when the page is
// left by creating a project.
//
// Each layer is its own clipped element, wiped open from the screen edge with
// a clip-path inset and faded up from 0 — a reveal rather than a scale, so the 8px bars never
// squash mid-motion. Entering, the core leads and the shells follow outward;
// leaving runs the other way, outermost first, and quicker (the system
// responding, not presenting). Strong ease-out both ways, per
// .agents/skills/review-animations/STANDARDS.md — never ease-in.

const EASE = "cubic-bezier(0.23,1,0.32,1)"
const ENTER_MS = 700
const ENTER_STAGGER_MS = 70
const EXIT_MS = 420
const EXIT_STAGGER_MS = 50

// Wipe order, inner first. The shell's dither bands go with the shell.
const REVEAL_ORDER: SideArtLayer[][] = [
  ["core"],
  ["ridge"],
  ["dashed"],
  ["light", "fade1", "fade2", "fade3", "fade4"],
]
const revealStep = (layer: SideArtLayer) =>
  REVEAL_ORDER.findIndex((group) => group.includes(layer))
// Each layer fades in as it wipes in and out as it retreats, so the edge
// doesn't arrive sharp. (A blur did this job first; swapped for opacity by
// request.) Classes are spelled out in full at each use: Tailwind only
// generates classes it can see as literal strings.

// The whole retreat, last layer included.
const EXIT_TOTAL_MS = EXIT_MS + (REVEAL_ORDER.length - 1) * EXIT_STAGGER_MS
// The page's own copy (title, text, button, log out) fades out as the art
// nears the end of its retreat, finishing just before it — the art is the
// last thing to go.
const CONTENT_FADE_MS = 280
const CONTENT_FADE_DELAY_MS = EXIT_TOTAL_MS - CONTENT_FADE_MS - 80

type LeaveControls = {
  // Start the exit. Resolves once the art is fully tucked away — the next
  // page waits on that (exit-gate.tsx).
  leave: () => Promise<void>
}

const LeaveContext = React.createContext<LeaveControls | null>(null)

// For the create-project dialog. Null anywhere without a backdrop (the same
// dialog opens from the /projects grid), so callers use `?.`.
export function useCreateProjectLeave() {
  return React.useContext(LeaveContext)
}

export function CreateProjectScene({
  children,
}: {
  children: React.ReactNode
}) {
  const [leaving, setLeaving] = React.useState(false)
  // The art renders hidden (opacity 0, clipped to the edge) and is switched
  // on only after a frame has been painted that way — so the entrance always
  // starts from nothing. @starting-style did this job first, but it doesn't
  // hold for the server-rendered first paint: the art could flash in fully
  // before the transition ran.
  const [entered, setEntered] = React.useState(false)
  React.useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true))
    })
    // rAF never fires in a background tab; don't leave the art hidden there.
    const fallback = setTimeout(() => setEntered(true), 150)
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
      clearTimeout(fallback)
    }
  }, [])
  const shown = entered && !leaving

  const controls = React.useMemo<LeaveControls>(
    () => ({
      leave: () => {
        setLeaving(true)
        // A timer rather than transitionend: with reduced motion there is
        // no transition to end, and a backgrounded tab suspends the event.
        return new Promise((resolve) => setTimeout(resolve, EXIT_TOTAL_MS))
      },
    }),
    []
  )

  return (
    <LeaveContext.Provider value={controls}>
      <Side edge="left" shown={shown} leaving={leaving} />
      <Side edge="right" shown={shown} leaving={leaving} />
      {/* Unpositioned on purpose: the page's absolutely-placed pieces (the
          wordmark, log out) keep resolving against the page container. */}
      <div
        className={cn(
          "transition-opacity motion-reduce:transition-none",
          leaving && "opacity-0"
        )}
        style={{
          transitionTimingFunction: EASE,
          transitionDuration: `${CONTENT_FADE_MS}ms`,
          transitionDelay: leaving ? `${CONTENT_FADE_DELAY_MS}ms` : "0ms",
        }}
      >
        {children}
      </div>
    </LeaveContext.Provider>
  )
}

function Side({
  edge,
  shown,
  leaving,
}: {
  edge: "left" | "right"
  shown: boolean
  // Picks the retreat's timing over the entrance's.
  leaving: boolean
}) {
  return (
    <div
      aria-hidden
      className={cn(
        // 31.1% of the width: the original's 28.3% (816 of 2880px) for the
        // shell, scaled by 56/51 for the dither it now fades into. On a
        // narrow screen it's capped at the room beside the 272px (w-68)
        // content column, so the art never runs under the copy.
        "pointer-events-none absolute inset-y-0 w-[min(31.111vw,calc((100vw-var(--spacing)*68)/2))]",
        // The right side is the left one mirrored, so "from the edge" is the
        // same inset for both.
        edge === "left" ? "left-0" : "right-0 -scale-x-100"
      )}
    >
      {SIDE_ART_LAYERS.map((layer) => {
        const enterStep = revealStep(layer)
        const exitStep = REVEAL_ORDER.length - 1 - enterStep
        return (
          <div
            key={layer}
            className={cn(
              "absolute inset-0 transition-[clip-path,opacity] motion-reduce:transition-none",
              shown
                ? "opacity-100 [clip-path:inset(0_0_0_0)]"
                : "opacity-0 [clip-path:inset(0_100%_0_0)]"
            )}
            style={{
              transitionTimingFunction: EASE,
              transitionDuration: `${leaving ? EXIT_MS : ENTER_MS}ms`,
              transitionDelay: `${
                leaving
                  ? exitStep * EXIT_STAGGER_MS
                  : enterStep * ENTER_STAGGER_MS
              }ms`,
            }}
          >
            <SideArt layer={layer} className="size-full" />
          </div>
        )
      })}
    </div>
  )
}
