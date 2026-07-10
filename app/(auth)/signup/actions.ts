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
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  })

  if (error) {
    return { error: error.message }
  }

  // Supabase deliberately returns success (not an error) for an email that's
  // already registered, to avoid leaking which emails exist. The one signal
  // it does give: `identities` comes back empty instead of containing the
  // new email/password identity.
  if (data.user?.identities?.length === 0) {
    return { error: "This email is already in use" }
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
): Promise<{ error: true } | void> {
  const parsed = verifySignupSchema.safeParse(input)

  if (!parsed.success) {
    return { error: true }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "signup",
  })

  // Supabase's verifyOtp doesn't distinguish a wrong code from an expired
  // one (both return error_code "otp_expired") — the caller picks the
  // right message client-side from elapsed time. See lib/supabase/otp-error.
  if (error) {
    return { error: true }
  }

  // A fresh account can't have a project yet — land on the no-project screen.
  redirect("/create-project")
}
