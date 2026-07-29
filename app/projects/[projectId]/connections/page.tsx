import { Plugs } from "@phosphor-icons/react/dist/ssr"

import { AiModelsCard } from "@/components/connections/ai-models-card"
import { DottedDivider } from "@/components/instructions/dotted-divider"
import { InstructionsCard } from "@/components/instructions/instructions-card"
import { fetchUserAiModels } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

// Connections screen. No Figma export exists for it yet, so the layout
// borrows the Instructions page's column rhythm and card shell rather than
// inventing a new one — restyle once the frame lands in design-sync/.
//
// AI models are user-scoped, not project-scoped (see types/ai-model.ts): a
// model added here shows up in every project's Generate page. Social accounts
// are the other half of this page per the IA, but OAuth isn't built yet.
export default async function ConnectionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()
  const models = await fetchUserAiModels(supabase)

  return (
    // Same unified blur+opacity mount-in as the dashboard and Instructions
    // pages (see those for the @starting-style rationale).
    <div className="flex flex-1 flex-col items-start gap-dist-md transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px] xl:flex-row">
      <AiModelsCard
        projectId={projectId}
        initial={models}
        className="xl:min-w-0 xl:max-w-md xl:flex-1"
      />

      <InstructionsCard
        title="Social accounts"
        description="Connect LinkedIn and X so Presto can publish the posts it schedules."
        className="xl:min-w-0 xl:max-w-md xl:flex-1"
      >
        <DottedDivider />
        <div className="flex items-center gap-dist-md text-text-subtle">
          <Plugs className="size-5 shrink-0" weight="bold" />
          <p className="text-body-lg">Coming soon</p>
        </div>
      </InstructionsCard>
    </div>
  )
}
