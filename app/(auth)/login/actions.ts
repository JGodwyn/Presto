"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { hasProjects } from "@/lib/supabase/queries"
import {
  isNetworkError,
  networkActionError,
  type ActionError,
} from "@/lib/network-error"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>

export async function login(
  input: LoginInput
): Promise<ActionError | void> {
  const parsed = loginSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter a valid email and password." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    // A request that never reached Supabase rejects here exactly like a
    // rejected credential does, which is how a dropped connection ended up
    // telling people their password was wrong. Check that first.
    if (isNetworkError(error)) return networkActionError()
    // Supabase deliberately returns one generic error for both an unknown
    // email and a wrong password, to avoid leaking which emails exist.
    return { error: "Incorrect email or password." }
  }

  // Users with projects land on the project picker; the rest start at the
  // no-project empty state. Dashboards live inside a project
  // (/projects/<id>/dashboard), so there's no project-less landing page.
  redirect((await hasProjects(supabase)) ? "/projects" : "/create-project")
}
