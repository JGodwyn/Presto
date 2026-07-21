"use client"

import * as React from "react"

import { GenerateCard, type GenerateCardHandle } from "@/components/generate/generate-card"
import { GeneratePanel } from "@/components/generate/generate-panel"

// Built from the Figma "Generate (Number based)" export
// (design-sync/generate-number-based). UI only — generation itself, the real
// model/account lists, and the calendar-based mode's design come later.
//
// Client component (not server) so it can hold the ref connecting
// GeneratePanel's reset button to GenerateCard's internal calendar state —
// see GenerateCardHandle for why that's a ref rather than lifted props.
export default function GeneratePage() {
  const generateCardRef = React.useRef<GenerateCardHandle>(null)

  return (
    <GeneratePanel
      onResetCalendar={() => generateCardRef.current?.resetCalendar()}
    >
      <GenerateCard ref={generateCardRef} />
    </GeneratePanel>
  )
}
