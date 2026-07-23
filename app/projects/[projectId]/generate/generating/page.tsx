"use client"

import * as React from "react"
import { ViewTransition } from "react"
import { useParams, useSearchParams } from "next/navigation"

import { GeneratingView } from "@/components/generate/generating-view"

// Suspense boundary: useSearchParams opts the tree below it out of static
// prerendering (see next/docs use-search-params.md) — scoping that to just
// this reader keeps the rest of the page eligible.
function GeneratingPageContent({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams()
  const count = Math.max(1, Number(searchParams.get("count")) || 1)

  return (
    // enter="blur-in" pairs with generate/page.tsx's exit="blur-out" (see
    // app/globals.css) — the other half of the blur handoff arriving from
    // the Generate page. default="none" for the same reason as that side:
    // this page has its own useTransition (the Close button below), which
    // shouldn't also replay this animation.
    <ViewTransition enter="blur-in" default="none">
      <GeneratingView
        backHref={`/projects/${projectId}/generate`}
        count={count}
      />
    </ViewTransition>
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
