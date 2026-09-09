"use client"

import * as React from "react"
import { ViewTransition } from "react"

import { GenerateCard, type GenerateCardHandle } from "@/components/generate/generate-card"
import { GeneratePanel } from "@/components/generate/generate-panel"

export function GeneratePageClient({
  hasInstructions,
}: {
  hasInstructions: boolean
}) {
  const generateCardRef = React.useRef<GenerateCardHandle>(null)

  return (
    // exit="blur-out" pairs with generate/generating/page.tsx's
    // enter="blur-in" (see app/globals.css) for the blur handoff to the
    // Generating page. default="none" keeps this from also firing for
    // unrelated transitions — e.g. the Generate button's own useTransition
    // in generate-card.tsx, which is a transition too but isn't a route
    // change.
    <ViewTransition exit="blur-out" default="none">
      <GeneratePanel
        onResetCalendar={() => generateCardRef.current?.resetCalendar()}
      >
        <GenerateCard ref={generateCardRef} hasInstructions={hasInstructions} />
      </GeneratePanel>
    </ViewTransition>
  )
}
