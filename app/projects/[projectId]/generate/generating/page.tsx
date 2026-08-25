"use client"

import * as React from "react"
import { ViewTransition } from "react"
import { useParams, useSearchParams } from "next/navigation"

import { TRY_OUT_ACCOUNT_ID } from "@/components/generate/account-options"
import { GeneratingView } from "@/components/generate/generating-view"
import type { SocialPlatform } from "@/components/generate/social-platform-options"
import { BUILTIN_MODEL_ID } from "@/lib/ai/generate"

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
  //
  // "Try out" (components/generate/account-options.tsx) still borrows
  // linkedin as its platform — it's a stand-in with no platform of its own,
  // and a post has to be written for *some* platform — but it no longer
  // *becomes* a LinkedIn post: isTryout rides alongside so the saved row
  // remembers which it was. Without that the card would later render a
  // throwaway post under the user's real account name.
  const accountParam = searchParams.get("account")
  const isTryout = accountParam === TRY_OUT_ACCOUNT_ID
  const account: SocialPlatform = accountParam === "x" ? "x" : "linkedin"
  // Unlike account, this isn't checked against a fixed list: a user-added
  // model is a user_ai_models row id, so any non-empty string is plausible
  // here. post-actions.ts's resolveModelSelection is the real gate — it
  // validates under RLS, which this client component can't do anyway. An
  // absent param still falls back to the built-in.
  const model = searchParams.get("model") || BUILTIN_MODEL_ID

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
        isTryout={isTryout}
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
