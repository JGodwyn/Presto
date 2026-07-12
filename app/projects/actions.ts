"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import type { Project } from "@/types/project"

// 80 mirrors the check constraint on public.projects.name.
const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

export async function createProject(
  input: CreateProjectInput
): Promise<{ error: string } | { project: Project }> {
  const parsed = createProjectSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter a project name of at most 80 characters." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You need to be signed in to create a project." }
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: parsed.data.name })
    .select("id, name, created_at")
    .single()

  if (error) {
    return { error: "Couldn't create the project. Please try again." }
  }

  revalidatePath("/projects")

  return {
    project: { id: data.id, name: data.name, createdAt: data.created_at },
  }
}
