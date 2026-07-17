import { MyVoiceCard } from "@/components/instructions/my-voice-card"
import { ReferenceCard } from "@/components/instructions/reference-card"
import { WritingStyleCard } from "@/components/instructions/writing-style-card"
import { createClient } from "@/lib/supabase/server"
import {
  fetchContentReferences,
  fetchInstructions,
  fetchWritingStyles,
} from "@/lib/supabase/queries"

// Instructions screen from the Figma "Instructions" export: three cards —
// My voice (the instruction fields, auto-saved on blur and prefilled from
// public.instructions here), My writing style (entries from
// public.writing_styles, added via the writing-style modal — see the "My
// writing style (Content added)" export for its non-empty layout), and
// References (entries from public.content_references, added via the
// reference modal — built to work identically to My writing style, just
// against its own table/bucket/copy). Same unified blur+opacity mount-in as
// the dashboard (see that page for the @starting-style rationale).
export default async function InstructionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()
  // The layout already redirected if this project isn't the caller's; under
  // RLS a foreign id would come back null (same as no row yet) anyway.
  const [instructions, writingStyles, references] = await Promise.all([
    fetchInstructions(supabase, projectId),
    fetchWritingStyles(supabase, projectId),
    fetchContentReferences(supabase, projectId),
  ])

  return (
    // xl:min-w-0 overrides flexbox's default min-width:auto on each column —
    // without it, an unbreakable long chip/word can force that column past
    // its flex-basis share, shrinking the other two. xl:max-w-md caps how
    // wide any one column can grow on top of that.
    <div className="flex flex-1 flex-col items-start gap-dist-md transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px] xl:flex-row">
      <MyVoiceCard
        projectId={projectId}
        initial={instructions}
        className="xl:min-w-0 xl:max-w-md xl:flex-1"
      />

      <WritingStyleCard
        projectId={projectId}
        initial={writingStyles}
        className="xl:min-w-0 xl:max-w-md xl:flex-1"
      />

      <ReferenceCard
        projectId={projectId}
        initial={references}
        className="xl:min-w-0 xl:max-w-md xl:flex-1"
      />
    </div>
  )
}
