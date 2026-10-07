"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { OnboardingCoverGradient } from "@/components/onboarding/onboarding-cover-gradient"
import { Button } from "@/components/ui/button"
import { useOnboarding } from "./onboarding-context"

// Full-screen accept/decline gate (Figma "Onboarding 0") — sits above
// everything, including the navbar and sidebar, with the dashboard behind
// it dimmed and blurred out. "Show me around" begins the 5-step tour;
// "Skip" dismisses it entirely (same persistence as ending the tour early).

// The artwork rises from the bottom edge the way the landing hero's bars do
// (components/shared/textured-gradient.tsx, HERO_ANIMATION): a slow, heavy
// spring on scaleY from 0, anchored at the bottom, after a 0.1s beat.
// Copied rather than imported so the two can be tuned apart — and because
// that file belongs to the landing work.
const RISE = {
  type: "spring",
  stiffness: 200,
  damping: 32,
  mass: 9,
  delay: 0.1,
} as const

// Leaving used to be an unmount — the cover vanished in one frame and the
// tour's chrome was simply there. It now dissolves (fade + blur, the inverse
// of its own entrance) over the tour, which is already rendering underneath,
// so the hand-off reads as one surface clearing rather than a cut. Ease-out
// and shorter than the entrance: the system is responding to a click.
const EXIT = { duration: 0.25, ease: [0.23, 1, 0.32, 1] } as const

export function OnboardingCover() {
  const { step, start, end } = useOnboarding()
  const prefersReducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {step === "cover" && (
        <motion.div
          key="onboarding-cover"
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden"
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, filter: "blur(8px)", pointerEvents: "none" }
          }
          transition={EXIT}
        >
          {/* The artwork is drawn in code (onboarding-cover-gradient.tsx); it's
              transparent where it's white, so it carries bg-surface-4 to stay as
              opaque as the image it replaced.
              Figma's frame puts a 60%-white/8px-blur fill *behind* this artwork
              and the copy — but the artwork is opaque and edge-to-edge, so that
              fill/blur never actually shows through either way. Rendering it as
              a literal backdrop-blur layer here (stacked after the image) blurred
              the image itself instead, which is the bug: the reference screenshot
              shows the gradient crisp, not hazy. Dropping the redundant layer
              fixes it and matches the screenshot exactly. */}
          {/* Same mount-in as the content block below — the artwork previously had
              no transition at all, so it popped in solid a beat before the text
              faded in, making the whole cover read as "snapping into view"
              overall (annotation feedback). Same duration/easing so both surfaces
              materialize together as one moment rather than a staggered reveal. */}
          {/* The white backdrop fades in as one piece; only the art rises, so the
              page never shows through underneath it while it grows. */}
          <div className="absolute inset-0 bg-surface-4 transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0" />
          <motion.div
            aria-hidden
            className="absolute inset-0 origin-bottom"
            initial={prefersReducedMotion ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={RISE}
          >
            <OnboardingCoverGradient className="size-full" />
          </motion.div>

          {/* Same unified blur+opacity mount-in as /projects and /create-project
              (see those for the @starting-style rationale) — a rare, first-time
              moment earns a little entrance per the animation-standards
              frequency table. */}
          <div className="relative flex w-90 flex-col items-center gap-dist-md pb-pad-5xl text-center transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
            <h1 className="text-heading-md font-display text-shadow-[0px_2px_0px_rgba(0,0,0,0.3)] text-text-inverse">
              Let&apos;s get you on…
            </h1>
            <p className="text-body-lg-bold text-text-inverse">
              Let&apos;s show you around. You&apos;ll see what each section does
              so you know where to go.
            </p>
            <Button
              variant="brand-secondary"
              size="xl"
              className="w-full"
              onClick={start}
            >
              Show me around
            </Button>
            <Button variant="brand" size="xl" className="w-full" onClick={end}>
              Skip, I&apos;ll find my way
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
