"use client"

import { ArrowRight, Check } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { ONBOARDING_STEPS } from "./steps"
import { useOnboarding } from "./onboarding-context"

const CARD_CORNER_RADIUS = 16 // rad-lg

// The card's vertical offset mirrors ProjectSidebar's own rhythm — pad-md
// container padding, 2.5rem/40px-tall SideBarItems, dist-md gaps between
// them — so it lines up with whichever nav item it's explaining without
// measuring the DOM. The `- pad-lg` corrects for this card rendering inside
// <main>'s own padding, while the sidebar's rhythm is measured from the
// shared row's top edge. Keep both in sync if that spacing ever changes.
//
// Expressed as a `translate` (not `top`) so moving between steps animates on
// the compositor instead of triggering layout — per the animation standards'
// "only animate transform and opacity" rule.
function calloutOffset(index: number) {
  return `0 calc(var(--pad-md) - var(--pad-lg) + ${index} * (2.5rem + var(--dist-md)))`
}

// Wraps the main content area during the tour (Figma "Onboarding 1-5"):
// whatever page is actually rendered gets dimmed and blurred behind a
// purple callout card explaining one nav section — the tour narrates in
// place rather than forcing navigation. Outside the tour this is a
// transparent pass-through.
export function OnboardingCallout({
  children,
}: {
  children: React.ReactNode
}) {
  const { step, next, end } = useOnboarding()
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: CARD_CORNER_RADIUS,
    cornerSmoothing: 1,
  })

  if (typeof step !== "number") return <>{children}</>

  const index = step - 1
  const current = ONBOARDING_STEPS[index]
  const Icon = current.icon
  const isLastStep = step === 5

  return (
    // flex flex-col (not just flex-1): the wrapped page relies on being a
    // flex child of something to make its own `flex-1 justify-center` work
    // (that's how it centers vertically outside the tour, as a direct child
    // of <main>). Without `flex` here too, `children` was just a block box
    // sized to its content, so it rendered top-aligned instead.
    <div className="relative flex flex-1 flex-col">
      {children}

      {/* Mounts once per tour (this whole branch appears the moment the
          cover hands off to step 1), so the starting-style entrance only
          plays that first time — not on every step change. */}
      <div className="absolute inset-0 rounded-rad-lg bg-white/10 backdrop-blur transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0" />

      {/* The card itself never remounts across steps (same ref, same
          squircle instance) — only its position (`translate`) changes, so
          that transitions smoothly between steps. On its one-time mount,
          opacity/scale/blur also animate in together (Apple's "materialize,
          don't just fade" — scale and blur settling alongside opacity reads
          as a real surface arriving, not a plain fade); `starting:` only
          fires at insertion, so it doesn't replay on step changes. One
          shared ease-out keeps both cases simple rather than fighting over
          per-property easing. Sizing (`h-auto`-implied hug) still jumps
          instantly with content length — animating height would mean
          animating a layout property, which the standards explicitly rule
          out. */}
      <div
        ref={ref}
        style={{ ...style, translate: calloutOffset(index) }}
        className="absolute top-0 left-pad-lg w-86 rounded-rad-lg border-[length:var(--stroke-xl)] border-purple-700 bg-purple-500 p-pad-xl transition-[translate,opacity,filter,scale] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-95 starting:opacity-0 starting:blur-[8px]"
      >
        {/* Keyed on step so each one is a fresh element: the icon/heading/
            description/button swap gets its own starting-style entrance
            instead of silently updating in place with no transition at all
            (the bug being fixed here). No exit animation — matches this
            codebase's existing mount-in-only convention (no animation
            library installed to run a real crossfade). */}
        <div
          key={step}
          className="flex flex-col gap-dist-lg transition-[opacity,filter,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:translate-y-1 starting:opacity-0 starting:blur-[4px]"
        >
          <Icon weight="bold" className="size-8 text-text-inverse" />
          <h2 className="text-heading-sm font-display whitespace-pre-line text-text-inverse">
            {current.heading}
          </h2>
          <p className="text-body-lg text-text-inverse">
            {current.description}
          </p>
          {isLastStep ? (
            <Button
              variant="success"
              size="xl"
              className="w-fit"
              onClick={end}
            >
              Complete
              <Check weight="bold" />
            </Button>
          ) : (
            <Button
              variant="brand-secondary"
              size="xl"
              className="w-fit"
              onClick={next}
            >
              Next
              <ArrowRight weight="bold" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
