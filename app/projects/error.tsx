"use client"

import { RouteErrorRecovery } from "@/components/shared/route-error-recovery"

// Covers the project picker (fetchProjects) *and* app/projects/[projectId]/
// layout.tsx — a layout's own errors are caught by the boundary one segment
// up, not by a sibling error.tsx. That layout's fetchProject throwing on an
// unreachable database is the exact case this exists for.
export default function ProjectsError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col p-pad-4xl">
      <RouteErrorRecovery reset={reset} />
    </div>
  )
}
