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
