"use client"

import { Check, X } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { useOnboarding } from "./onboarding-context"

// Replaces the project's normal navbar for the duration of the tour (Figma
// "Onboarding 1-5") — the label says what's happening, and the action on
// the right ends it: "End onboarding" for steps 1-4, "Complete onboarding"
// once the last step is reached. Both just call `end()`; the only
// difference is which reads right for where the user is in the tour.
export function OnboardingTopbar() {
  const { step, end } = useOnboarding()
  const isLastStep = step === 5

  return (
    <header className="flex items-center justify-between">
      <span className="text-heading-sm font-display text-text-subtle">
        Onboarding
      </span>
      {isLastStep ? (
        <Button variant="success" size="xl" onClick={end}>
          <Check weight="bold" />
          Complete onboarding
        </Button>
      ) : (
        <Button variant="danger" size="xl" onClick={end}>
          <X weight="bold" />
          End onboarding
        </Button>
      )}
    </header>
  )
}
