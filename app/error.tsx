"use client"

import { RouteErrorRecovery } from "@/components/shared/route-error-recovery"

// Catch-all boundary for routes without a closer one (/, /create-project,
// /settings). It does not cover app/layout.tsx itself — that would need
// global-error.tsx — but the root layout only renders chrome, it never
// fetches, so there's nothing there to fail this way.
export default function RootError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col p-pad-4xl">
      <RouteErrorRecovery reset={reset} />
    </div>
  )
}
