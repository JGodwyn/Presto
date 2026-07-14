"use client"

import { ArrowClockwise } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { useOnboarding } from "./onboarding-context"

// Dev/testing convenience: re-shows the cover without having to clear
// localStorage. Not part of the Figma dashboard design, so kept small and
// out of the way (outline, not brand-colored) rather than competing with
// the actual empty state.
export function ReplayOnboardingButton() {
  const { restart } = useOnboarding()

  return (
    <Button variant="outline" size="sm" onClick={restart}>
      <ArrowClockwise weight="bold" />
      Replay onboarding
    </Button>
  )
}
