"use server"

import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  isNetworkError,
  networkActionError,
  type ActionError,
} from "@/lib/network-error"

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export async function requestPasswordReset(
  input: ForgotPasswordInput
): Promise<ActionError | { success: true }> {
  const parsed = forgotPasswordSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter a valid email." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email)

  if (error) {
    if (isNetworkError(error)) return networkActionError()
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
): Promise<{ error: true; network?: true } | { success: true }> {
  const parsed = verifyRecoverySchema.safeParse(input)

  if (!parsed.success) {
    return { error: true }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "recovery",
  })

  // Supabase's verifyOtp doesn't distinguish a wrong code from an expired
  // one (both return error_code "otp_expired") — the caller picks the
  // right message client-side from elapsed time. See lib/supabase/otp-error.
  // Unless the request never landed, in which case neither reading is true.
  if (error) {
    if (isNetworkError(error)) return { error: true, network: true }
    return { error: true }
  }

  return { success: true }
}

const updatePasswordSchema = z.object({
  password: z.string().min(8),
})

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>

export async function updatePassword(
  input: UpdatePasswordInput
): Promise<ActionError | { success: true }> {
  const parsed = updatePasswordSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Password must be at least 8 characters." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    if (isNetworkError(error)) return networkActionError()
    return { error: error.message }
  }

  // Sign out of the recovery session so the user re-authenticates with
  // their new password, matching the UI flow back to the Login screen.
  await supabase.auth.signOut()

  return { success: true }
}
