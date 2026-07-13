import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { hasProjects } from "@/lib/supabase/queries"

// The root has no screen of its own — it fans out the same way login does:
// signed out → login, no projects → the empty state, otherwise the picker.
export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")
  redirect((await hasProjects(supabase)) ? "/projects" : "/create-project")
}
