"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Info, StopCircle, X } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { GeneratingPostCard } from "@/components/generate/generating-post-card"

// Built from the Figma "Generate / Generating template" export
// (design-sync/generate-generating-template). UI + navigation only — real
// generation isn't wired up yet, so every card renders the same loading
// placeholder and Close/Stop both just return to the settings screen.
// Deliberately its own page (not folded into GenerateCard) so the transition
// and this state's animations can be iterated on independently.
export function GeneratingView({
  backHref,
  count,
}: {
  backHref: string
  count: number
}) {
  const router = useRouter()
  const goBack = () => router.push(backHref)

  return (
    <div className="mx-auto flex w-230 max-w-full flex-col gap-dist-xl transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      <div className="flex w-full flex-col gap-dist-md">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-dist-md">
            <Button
              variant="brand-secondary"
              size="icon-sm"
              aria-label="Close"
              onClick={goBack}
            >
              <X weight="bold" />
            </Button>
            <h1 className="text-heading-sm font-display text-text-bold">
              generating posts . . .
            </h1>
          </div>
          <Button variant="danger" size="sm" onClick={goBack}>
            <StopCircle weight="fill" />
            Stop
          </Button>
        </div>

        <p className="flex items-center gap-dist-md text-body-md text-text-subtle">
          <Info className="size-5 text-icon-subtle" />
          Double-tap to edit posts
        </p>
      </div>

      <div className="flex flex-wrap gap-dist-lg p-pad-xs">
        {Array.from({ length: count }, (_, i) => (
          <GeneratingPostCard key={i} />
        ))}
      </div>
    </div>
  )
}
