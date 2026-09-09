import { GeneratePageClient } from "@/components/generate/generate-page-client"
import { createClient } from "@/lib/supabase/server"
import { fetchInstructions } from "@/lib/supabase/queries"
import type { Instructions } from "@/types/instructions"

// Built from the Figma "Generate (Number based)" export
// (design-sync/generate-number-based). UI only — generation itself, the real
// model/account lists, and the calendar-based mode's design come later.
//
// The server resolves whether this project has Instructions before handing
// interactions to GeneratePageClient. That keeps the disabled state from
// flashing in after hydration and prevents a pointless route transition.
function hasInstructionContent(instructions: Instructions | null) {
  if (!instructions) return false

  // A row remains after the last topic or field is deleted, because it is the
  // project's autosave record — it must not itself count as personalization.
  // Single-prompt mode intentionally replaces the structured fields, matching
  // buildPostPrompt's own branch.
  if (instructions.singlePrompt) {
    return (
      instructions.singlePromptText.trim().length > 0 ||
      instructions.topics.length > 0
    )
  }

  return (
    instructions.tone.trim().length > 0 ||
    instructions.contentRules.trim().length > 0 ||
    instructions.postStructure.trim().length > 0 ||
    instructions.whatToAvoid.trim().length > 0 ||
    instructions.topics.length > 0
  )
}

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const instructions = await fetchInstructions(await createClient(), projectId)

  return <GeneratePageClient hasInstructions={hasInstructionContent(instructions)} />
}
