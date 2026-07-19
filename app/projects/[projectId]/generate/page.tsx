import { GenerateCard } from "@/components/generate/generate-card"
import { GeneratePanel } from "@/components/generate/generate-panel"

// Built from the Figma "Generate (Number based)" export
// (design-sync/generate-number-based). UI only — generation itself, the real
// model/account lists, and the calendar-based mode's design come later.
export default function GeneratePage() {
  return (
    <GeneratePanel>
      <GenerateCard />
    </GeneratePanel>
  )
}
