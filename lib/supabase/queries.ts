import type { SupabaseClient } from "@supabase/supabase-js"

import type { Project } from "@/types/project"

// RLS on public.projects already scopes every query to the signed-in user,
// so these take whatever client the caller has (server or browser) and add
// no user_id filtering of their own. Row → shared-shape mapping happens here
// and nowhere else.

export async function fetchProjects(
  supabase: SupabaseClient
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .order("created_at", { ascending: true })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }))
}

export async function fetchProject(
  supabase: SupabaseClient,
  id: string
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return { id: data.id, name: data.name, createdAt: data.created_at }
}

export async function hasProjects(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })

  if (error) throw error

  return (count ?? 0) > 0
}
