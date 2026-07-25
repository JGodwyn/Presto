"use client"

import * as React from "react"
import { ViewTransition } from "react"
import { useParams, useSearchParams } from "next/navigation"

import { GeneratingView } from "@/components/generate/generating-view"
import type { SocialPlatform } from "@/components/generate/social-platform-options"
import { GENERATION_MODELS, type GenerationModel } from "@/lib/ai/generate"

// Suspense boundary: useSearchParams opts the tree below it out of static
// prerendering (see next/docs use-search-params.md) — scoping that to just
// this reader keeps the rest of the page eligible.
function GeneratingPageContent({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams()
  const count = Math.max(1, Number(searchParams.get("count")) || 1)
  // Whichever account GenerateCard's SelectPill had selected — every card
  // in the batch starts posting to this one (still individually
  // changeable by tapping its own social pill). Falls back to "linkedin"
  // for any URL that doesn't carry a recognized value.
  const accountParam = searchParams.get("account")
  const account: SocialPlatform = accountParam === "x" ? "x" : "linkedin"
  // Same fallback pattern as account — defaults to the real model for any
  // URL that doesn't carry a recognized value.
  const modelParam = searchParams.get("model")
  const model: GenerationModel = GENERATION_MODELS.includes(modelParam as GenerationModel)
    ? (modelParam as GenerationModel)
    : "gemini-3.6-flash"

  return (
    // enter="blur-in" pairs with generate/page.tsx's exit="blur-out" (see
    // app/globals.css) — the other half of the blur handoff arriving from
    // the Generate page. default="none" for the same reason as that side:
    // this page has its own useTransition (the Close button below), which
    // shouldn't also replay this animation.
    <ViewTransition enter="blur-in" default="none">
      <GeneratingView
        backHref={`/projects/${projectId}/generate`}
        projectId={projectId}
        count={count}
        account={account}
        model={model}
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
