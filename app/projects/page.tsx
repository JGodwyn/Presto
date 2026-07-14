import Link from "next/link"
import { redirect } from "next/navigation"

import { NewProjectFolder } from "@/components/projects/new-project-folder"
import { ProjectFolder } from "@/components/projects/project-folder"
import { ProjectsNavbar } from "@/components/projects/projects-navbar"
import { createClient } from "@/lib/supabase/server"
import { fetchProjects } from "@/lib/supabase/queries"
import { cn } from "@/lib/utils"

// Same unified blur+opacity mount-in as /create-project (see that page for
// the @starting-style rationale) — applied to the folder grid only, so the
// navbar reads as persistent chrome.
const ENTRANCE_TRANSITION =
  "transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]"

// "Your projects" — where the create-project flow lands (Figma frame of the
// same name). Full-bleed with its own navbar, like /create-project.
export default async function ProjectsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const projects = await fetchProjects(supabase)
  // The no-project empty state is a whole separate screen, not this page
  // with zero folders.
  if (projects.length === 0) redirect("/create-project")

  const firstName =
    (user.user_metadata?.name as string | undefined)?.trim().split(/\s+/)[0] ??
    "there"

  return (
    <div className="flex min-h-screen w-full flex-col gap-dist-5xl bg-surface-3 px-pad-xl py-pad-4xl lg:px-pad-8xl xl:px-pad-9xl">
      <ProjectsNavbar userName={firstName} />

      {/* The standard fluid card grid: fit as many ≥16rem (256px, the Figma
          folder width) columns as possible, then stretch them equally to fill
          the row exactly. The cards absorb the remainder, so the grid stays
          flush with both content edges — first column under the logo, last
          under the navbar chip — with the gap fixed at dist-xl. (A fixed-
          column grid can't do this: whatever width doesn't divide into whole
          columns has to pile up somewhere — all on the right when left-
          aligned, or as extra margin on both sides when centered, which read
          as uneven/floating against the full-width navbar.) auto-fill keeps
          empty tracks so a partial row stays left-aligned. */}
      <main
        className={cn(
          "grid flex-1 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] content-start gap-dist-xl",
          ENTRANCE_TRANSITION
        )}
      >
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}/dashboard`}
            className="group"
          >
            <ProjectFolder name={project.name} createdAt={project.createdAt} />
          </Link>
        ))}
        <NewProjectFolder />
      </main>
    </div>
  )
}
