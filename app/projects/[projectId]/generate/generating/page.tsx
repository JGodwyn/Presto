"use client"

import * as React from "react"
import { useParams, useSearchParams } from "next/navigation"

import { GeneratingView } from "@/components/generate/generating-view"

// Suspense boundary: useSearchParams opts the tree below it out of static
// prerendering (see next/docs use-search-params.md) — scoping that to just
// this reader keeps the rest of the page eligible.
function GeneratingPageContent({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams()
  const count = Math.max(1, Number(searchParams.get("count")) || 1)

  return (
    <GeneratingView
      backHref={`/projects/${projectId}/generate`}
      count={count}
    />
  )
}

export default function GeneratingPage() {
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <React.Suspense fallback={null}>
      <GeneratingPageContent projectId={projectId} />
    </React.Suspense>
  )
}
