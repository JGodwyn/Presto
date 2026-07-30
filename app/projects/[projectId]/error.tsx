"use client"

import { RouteErrorRecovery } from "@/components/shared/route-error-recovery"

// Covers the section pages inside a project (instructions, connections, …),
// each of which fetches its own data. The project chrome — navbar, sidebar —
// stays put around this, since the layout that renders it isn't what failed.
export default function ProjectError({ reset }: { reset: () => void }) {
  return <RouteErrorRecovery reset={reset} />
}
