import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { fetchProjects } from "@/lib/supabase/queries"

// Settings render inside a project's chrome, but the gear on the "Your
// projects" navbar has no project in scope — so this route forwards it into
// the first project's settings. Placeholder until settings gets a dedicated
// user-level screen (its content — account, model choice — is per-user).
export default async function SettingsRedirectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const projects = await fetchProjects(supabase)
  if (projects.length === 0) redirect("/create-project")

  redirect(`/projects/${projects[0].id}/settings`)
}
