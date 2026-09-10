"use client"

import { ProjectsNavbar } from "@/components/projects/projects-navbar"
import { OnboardingTopbar } from "@/components/onboarding/onboarding-topbar"
import { useOnboarding } from "@/components/onboarding/onboarding-context"
import { useExpiredConnection } from "@/components/connections/expired-connection-provider"

// Swaps the project's normal navbar for the onboarding bar while the tour
// is active (steps 1-5 — the cover overlay replaces everything, so it isn't
// handled here). Single integration point so the layout doesn't need to
// know about onboarding state itself.
export function ProjectTopbar({
  userName,
  userId,
  avatarUrl,
  gradientId,
  profileHref,
}: {
  userName: string
  userId?: string | null
  avatarUrl?: string | null
  gradientId?: string | null
  profileHref: string
}) {
  const { step } = useOnboarding()
  const { hasExpiredLinkedIn, connectionsHref } = useExpiredConnection()

  // On phones the exported tour keeps the normal compact brand bar visible;
  // its teaching surface lives over the section below, while the desktop tour
  // uses the dedicated progress/action bar.
  if (typeof step === "number") {
    return (
      <>
        {/* Mobile keeps the familiar brand bar from the export, but the
            callout is the tour's sole control. Leave this chrome visible
            without letting Back or Profile interrupt the sequence. */}
        <div inert className="md:hidden">
          <ProjectsNavbar
            userName={userName}
            userId={userId}
            avatarUrl={avatarUrl}
            gradientId={gradientId}
            profileHref={profileHref}
            backHref="/projects"
          />
        </div>
        <div className="hidden md:block">
          <OnboardingTopbar />
        </div>
      </>
    )
  }

  return (
    <ProjectsNavbar
      userName={userName}
      userId={userId}
      avatarUrl={avatarUrl}
      gradientId={gradientId}
      profileHref={profileHref}
      backHref="/projects"
      expiredConnectionHref={
        hasExpiredLinkedIn ? connectionsHref : undefined
      }
    />
  )
}
