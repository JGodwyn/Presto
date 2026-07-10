"use server"

import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export async function requestPasswordReset(
  input: ForgotPasswordInput
): Promise<{ error: string } | { success: true }> {
  const parsed = forgotPasswordSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter a valid email." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

const verifyRecoverySchema = z.object({
  email: z.string().email(),
  token: z.string().length(6),
})

export type VerifyRecoveryInput = z.infer<typeof verifyRecoverySchema>

export async function verifyRecoveryOtp(
  input: VerifyRecoveryInput
): Promise<{ error: string } | { success: true }> {
  const parsed = verifyRecoverySchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter the 6-digit code." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "recovery",
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

const updatePasswordSchema = z.object({
  password: z.string().min(8),
})

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>

export async function updatePassword(
  input: UpdatePasswordInput
): Promise<{ error: string } | { success: true }> {
  const parsed = updatePasswordSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Password must be at least 8 characters." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return { error: error.message }
  }

  // Sign out of the recovery session so the user re-authenticates with
  // their new password, matching the UI flow back to the Login screen.
  await supabase.auth.signOut()

  return { success: true }
}
