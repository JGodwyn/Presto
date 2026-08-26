import { Eyes } from "@phosphor-icons/react/dist/ssr"

import { EmptyState } from "@/components/shared/empty-state"
import { ReplayOnboardingButton } from "@/components/onboarding/replay-onboarding-button"
import { DashboardView } from "@/components/dashboard/dashboard-view"
import { createClient } from "@/lib/supabase/server"
import {
  fetchContentReferences,
  fetchInstructions,
  fetchPosts,
  fetchProject,
  fetchSocialAccounts,
  fetchUserAiModels,
  fetchWritingStyles,
} from "@/lib/supabase/queries"

// The project dashboard. Two states:
//
// - **No posts yet** — the Figma "Dashboard" export, which is only ever the
//   "Nothing here" empty state on the bare canvas (no GlowPanel).
// - **Posts exist** — DashboardView. There is *no* Figma frame for this, so it
//   is composed from tokens and the existing component vocabulary, borrowing
//   the Instructions page's rhythm: white cards on the surface-3 canvas rather
//   than Generate/Content's GlowPanel, which caps itself to the viewport
//   height and would force this page's cards into an inner scroller.
//   Restyle when a frame lands.
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()

  // The layout already redirected if this project isn't the caller's; under
  // RLS a foreign id would come back empty anyway.
  const [project, posts, instructions, writingStyles, references, socialAccounts, aiModels] =
    await Promise.all([
      fetchProject(supabase, projectId),
      fetchPosts(supabase, projectId),
      fetchInstructions(supabase, projectId),
      fetchWritingStyles(supabase, projectId),
      fetchContentReferences(supabase, projectId),
      fetchSocialAccounts(supabase, projectId),
      fetchUserAiModels(supabase),
    ])

  if (posts.length === 0) {
    return (
      <div className="relative flex flex-1 flex-col transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
        <div className="absolute top-0 right-0">
          <ReplayOnboardingButton />
        </div>

        {/* No action button, by request — the sidebar is right there, and a
            CTA that isn't wired to anything is worse than none. */}
        <EmptyState
          icon={Eyes}
          caption="Nothing here"
          title="Create some posts & your dashboard will come alive."
        />
      </div>
    )
  }

  const base = `/projects/${projectId}`

  return (
    <DashboardView
      projectId={projectId}
      projectName={project?.name ?? "This project"}
      posts={posts}
      instructions={instructions}
      writingStyleCount={writingStyles.length}
      referenceCount={references.length}
      socialAccounts={socialAccounts}
      aiModels={aiModels}
      // Stamped once here, for the request, so the future/past split is the
      // same on the server and through hydration — same reasoning (and the
      // same lint exemption) as the Content page's own `now`.
      // eslint-disable-next-line react-hooks/purity
      now={Date.now()}
      hrefs={{
        content: `${base}/calendar`,
        instructions: `${base}/instructions`,
        connections: `${base}/connections`,
        settings: `${base}/settings`,
        postBase: `${base}/calendar`,
      }}
    />
  )
}
