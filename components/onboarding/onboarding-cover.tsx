"use client"

import Image from "next/image"

import { Button } from "@/components/ui/button"
import { useOnboarding } from "./onboarding-context"

// Full-screen accept/decline gate (Figma "Onboarding 0") — sits above
// everything, including the navbar and sidebar, with the dashboard behind
// it dimmed and blurred out. "Show me around" begins the 5-step tour;
// "Skip" dismisses it entirely (same persistence as ending the tour early).
export function OnboardingCover() {
  const { step, start, end } = useOnboarding()

  if (step !== "cover") return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden">
      {/* Figma's frame puts a 60%-white/8px-blur fill *behind* this image and
          the copy — but the image is fully opaque and edge-to-edge, so that
          fill/blur never actually shows through either way. Rendering it as
          a literal backdrop-blur layer here (stacked after the image) blurred
          the image itself instead, which is the bug: the reference screenshot
          shows the gradient crisp, not hazy. Dropping the redundant layer
          fixes it and matches the screenshot exactly. */}
      {/* Same mount-in as the content block below — the image previously had
          no transition at all, so it popped in solid a beat before the text
          faded in, making the whole cover read as "snapping into view"
          overall (annotation feedback). Same duration/easing so both surfaces
          materialize together as one moment rather than a staggered reveal. */}
      <Image
        src="/images/onboarding/cover-gradient.webp"
        alt=""
        fill
        priority
        className="object-cover transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]"
      />

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
    </div>
  )
}
