"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

import { ONBOARDING_STEPS } from "./steps"

type OnboardingStep = 1 | 2 | 3 | 4 | 5

interface OnboardingContextValue {
  // "cover" = the full-screen accept/decline gate; a number = tour step
  // 1-5; null = inactive (never started yet, or dismissed).
  step: OnboardingStep | "cover" | null
  // The sidebar path this step is explaining, so ProjectSidebar can
  // force-highlight it regardless of the actual current route.
  activePath: string | null
  start: () => void
  next: () => void
  end: () => void
  // Re-shows the cover on demand (e.g. a "Replay onboarding" button) without
  // clearing browser storage — the tour just re-persists "done" when it's
  // dismissed again.
  restart: () => void
}

const noop = () => {}

const OnboardingContext = createContext<OnboardingContextValue>({
  step: null,
  activePath: null,
  start: noop,
  next: noop,
  end: noop,
  restart: noop,
})

// Global, not per-project: it's the same tour regardless of which project
// you're in, so having seen it once anywhere should skip it everywhere.
const STORAGE_KEY = "presto:onboarding:completed"

// Gates the onboarding cover + 5-step tour. Dismissal (skip or complete) is
// remembered in localStorage — no server round-trip or schema change, but
// also nothing synced across browsers or devices (by request; revisit if
// that turns out to matter).
export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [step, setStep] = useState<OnboardingStep | "cover" | null>(null)

  // Read after mount only: there's no localStorage on the server, and
  // deciding before hydration would make the server-rendered markup and the
  // first client render disagree about whether the cover is showing.
  useEffect(() => {
    const seen = window.localStorage.getItem(STORAGE_KEY)
    if (!seen) setStep("cover")
  }, [])

  const value = useMemo<OnboardingContextValue>(
    () => ({
      step,
      activePath:
        typeof step === "number" ? ONBOARDING_STEPS[step - 1].path : null,
      start: () => setStep(1),
      next: () =>
        setStep((current) =>
          typeof current === "number" && current < 5
            ? ((current + 1) as OnboardingStep)
            : current
        ),
      end: () => {
        window.localStorage.setItem(STORAGE_KEY, "done")
        setStep(null)
      },
      restart: () => setStep("cover"),
    }),
    [step]
  )

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  return useContext(OnboardingContext)
}
