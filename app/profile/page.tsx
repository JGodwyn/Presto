import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { fetchProjects } from "@/lib/supabase/queries"

// The profile screen renders inside a project's chrome, but the name chip on
// the "Your projects" navbar has no project in scope — so this route forwards
// it into the first project's profile, exactly as /settings does for the gear
// it replaced. Placeholder until profile gets a real user-level route.
export default async function ProfileRedirectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const projects = await fetchProjects(supabase)
  if (projects.length === 0) redirect("/create-project")

  redirect(`/projects/${projects[0].id}/profile`)
}
