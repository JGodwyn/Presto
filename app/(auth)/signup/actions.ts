"use server"

import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type SignupInput = z.infer<typeof signupSchema>

export async function signup(
  input: SignupInput
): Promise<{ error: string } | { success: true }> {
  const parsed = signupSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter a valid email and a password of at least 8 characters." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp(parsed.data)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
