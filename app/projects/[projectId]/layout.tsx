import { redirect } from "next/navigation"
import { z } from "zod"

import { ProjectSidebar } from "@/components/shared/project-sidebar"
import { ProjectTopbar } from "@/components/shared/project-topbar"
import { OnboardingProvider } from "@/components/onboarding/onboarding-context"
import { OnboardingCover } from "@/components/onboarding/onboarding-cover"
import { OnboardingCallout } from "@/components/onboarding/onboarding-callout"
import { createClient } from "@/lib/supabase/server"
import { fetchProject } from "@/lib/supabase/queries"

// Everything inside a project (dashboard, generate, calendar, …) renders
// under this layout, so the ownership check lives here once. RLS already
// hides other users' rows, meaning "no row" covers both a bad id and someone
// else's project — both land back on the picker rather than a 404.
const projectIdSchema = z.string().uuid()

// Chrome from the Figma "Dashboard" frame: the same full-bleed navbar as
// /projects (gear re-pointed at this project's settings) beside a floating
// sidebar card, on the shared surface-3 canvas. OnboardingProvider wraps all
// of it so the cover, the navbar swap, and the sidebar's forced-active state
// share one source of truth for tour progress.
export default async function ProjectLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}>) {
  const { projectId } = await params
  if (!projectIdSchema.safeParse(projectId).success) redirect("/projects")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const project = await fetchProject(supabase, projectId)
  if (!project) redirect("/projects")

  const firstName =
    (user.user_metadata?.name as string | undefined)?.trim().split(/\s+/)[0] ??
    "there"

  return (
    <OnboardingProvider>
      {/* h-screen (not min-h-screen) pins the chrome to the viewport: tall
          page content scrolls inside <main> instead of stretching the
          sidebar. The -mb/pb pair on <main> makes its scroll area bleed
          through the page's bottom padding to the real screen edge, so
          overflowing content visibly runs past the sidebar's foot rather
          than clipping at the padding line; the inner pb restores the same
          breathing room at the end of the scroll. */}
      <div className="flex h-screen w-full flex-col gap-dist-2xl bg-surface-3 px-pad-xl py-pad-4xl lg:px-pad-8xl xl:px-pad-9xl">
        <ProjectTopbar
          userName={firstName}
          settingsHref={`/projects/${projectId}/settings`}
        />

        <div className="flex min-h-0 flex-1 items-stretch gap-dist-xl">
          <ProjectSidebar projectName={project.name} />
          <main className="-mb-pad-4xl flex flex-1 flex-col overflow-y-auto pb-pad-4xl">
            <OnboardingCallout>{children}</OnboardingCallout>
          </main>
        </div>
      </div>

      <OnboardingCover />
    </OnboardingProvider>
  )
}
