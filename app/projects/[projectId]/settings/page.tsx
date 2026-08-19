import { logout } from "@/app/(auth)/logout/actions"
import { LogoutButton } from "@/app/projects/[projectId]/profile/logout-button"
import { AiModelsCard } from "@/components/settings/ai-models-card"
import { fetchUserAiModels } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

// Settings screen. No Figma export exists for it yet, so it borrows the
// Instructions page's column rhythm and card shell — restyle once the frame
// lands in design-sync/.
//
// AI models live here rather than on Connections because they're user-scoped,
// not project-scoped (see types/ai-model.ts): a key belongs to the person, and
// a model added once is usable in every project. Connections is for social
// accounts only. projectId is still threaded through the card because the
// server actions revalidate this route by path.
export default async function SettingsPage({
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
    <div className="flex flex-1 flex-col items-start gap-dist-xl transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      <AiModelsCard
        projectId={projectId}
        initial={models}
        className="w-full max-w-md"
      />

      <form action={logout}>
        <LogoutButton />
      </form>
    </div>
  )
}
