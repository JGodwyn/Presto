"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
})

export type SignupInput = z.infer<typeof signupSchema>

export async function signup(
  input: SignupInput
): Promise<{ error: string } | { success: true }> {
  const parsed = signupSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter a valid name, email, and a password of at least 8 characters." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

const verifySignupSchema = z.object({
  email: z.string().email(),
  token: z.string().length(6),
})

export type VerifySignupInput = z.infer<typeof verifySignupSchema>

export async function verifySignup(
  input: VerifySignupInput
): Promise<{ error: string } | void> {
  const parsed = verifySignupSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter the 6-digit code." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "signup",
  })

  if (error) {
    return { error: error.message }
  }

  redirect("/dashboard")
}
