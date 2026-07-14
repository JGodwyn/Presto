"use client"

import { ProjectsNavbar } from "@/components/projects/projects-navbar"
import { OnboardingTopbar } from "@/components/onboarding/onboarding-topbar"
import { useOnboarding } from "@/components/onboarding/onboarding-context"

// Swaps the project's normal navbar for the onboarding bar while the tour
// is active (steps 1-5 — the cover overlay replaces everything, so it isn't
// handled here). Single integration point so the layout doesn't need to
// know about onboarding state itself.
export function ProjectTopbar({
  userName,
  settingsHref,
}: {
  userName: string
  settingsHref: string
}) {
  const { step } = useOnboarding()

  if (typeof step === "number") return <OnboardingTopbar />

  return (
    <ProjectsNavbar
      userName={userName}
      settingsHref={settingsHref}
      backHref="/projects"
    />
  )
}
