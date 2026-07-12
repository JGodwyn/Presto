"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { hasProjects } from "@/lib/supabase/queries"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>

export async function login(input: LoginInput): Promise<{ error: string } | void> {
  const parsed = loginSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter a valid email and password." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    // Supabase deliberately returns one generic error for both an unknown
    // email and a wrong password, to avoid leaking which emails exist.
    return { error: "Incorrect email or password." }
  }

  // Users with projects land on the project picker; the rest start at the
  // no-project empty state. (Becomes /dashboard once that flow is decided.)
  redirect((await hasProjects(supabase)) ? "/projects" : "/create-project")
}
