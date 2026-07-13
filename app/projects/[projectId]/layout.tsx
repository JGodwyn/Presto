import { redirect } from "next/navigation"
import { z } from "zod"

import { ProjectsNavbar } from "@/components/projects/projects-navbar"
import { ProjectSidebar } from "@/components/shared/project-sidebar"
import { createClient } from "@/lib/supabase/server"
import { fetchProject } from "@/lib/supabase/queries"

// Everything inside a project (dashboard, generate, calendar, …) renders
// under this layout, so the ownership check lives here once. RLS already
// hides other users' rows, meaning "no row" covers both a bad id and someone
// else's project — both land back on the picker rather than a 404.
const projectIdSchema = z.string().uuid()

// Chrome from the Figma "Dashboard" frame: the same full-bleed navbar as
// /projects (gear re-pointed at this project's settings) beside a floating
// sidebar card, on the shared surface-3 canvas.
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
    <div className="flex min-h-screen w-full flex-col gap-dist-2xl bg-surface-3 px-pad-xl py-pad-4xl lg:px-pad-8xl">
      <ProjectsNavbar
        userName={firstName}
        settingsHref={`/projects/${projectId}/settings`}
      />

      <div className="flex flex-1 items-stretch gap-dist-xl">
        <ProjectSidebar projectName={project.name} />
        <main className="flex flex-1 flex-col p-pad-lg">{children}</main>
      </div>
    </div>
  )
}
