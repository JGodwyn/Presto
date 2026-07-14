import { Plus } from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import { DottedDivider } from "@/components/instructions/dotted-divider"
import { InstructionsCard } from "@/components/instructions/instructions-card"
import { MyVoiceCard } from "@/components/instructions/my-voice-card"
import { WritingStyleModal } from "@/components/instructions/writing-style-modal"
import { createClient } from "@/lib/supabase/server"
import { fetchInstructions } from "@/lib/supabase/queries"

// Instructions screen from the Figma "Instructions" export: three cards —
// My voice (the instruction fields, auto-saved on blur and prefilled from
// public.instructions here), My writing style (its "Add a style" CTA opens
// the writing-style modal), and the References empty state, whose CTA isn't
// wired yet. Same unified blur+opacity mount-in as the dashboard (see that
// page for the @starting-style rationale).
export default async function InstructionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()
  // The layout already redirected if this project isn't the caller's; under
  // RLS a foreign id would come back null (same as no row yet) anyway.
  const instructions = await fetchInstructions(supabase, projectId)

  return (
    <div className="flex flex-1 flex-col items-start gap-dist-md transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px] xl:flex-row">
      <MyVoiceCard
        projectId={projectId}
        initial={instructions}
        className="xl:flex-1"
      />

      <InstructionsCard
        title="My writing style"
        description="Show Presto real examples of writing you want your posts to sound like."
        className="xl:flex-1"
      >
        <DottedDivider />
        <WritingStyleModal />
      </InstructionsCard>

      <InstructionsCard
        title="References"
        description="Give Presto material to draw ideas and context from when generating posts."
        className="xl:flex-1"
      >
        <DottedDivider />
        <Button variant="brand" size="sm" className="self-start">
          <Plus weight="bold" />
          Add a reference
        </Button>
      </InstructionsCard>
    </div>
  )
}
