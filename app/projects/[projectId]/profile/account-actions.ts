"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  isNetworkError,
  networkActionError,
  type ActionError,
} from "@/lib/network-error"

// 8 characters matches the forgot-password flow's own minimum, so the two
// ways of setting a password can't disagree about what a valid one is.
const MIN_PASSWORD_LENGTH = 8

// Shape only. The length and sameness rules are checked in the body instead,
// because *the order they run in is part of the contract* (see below) and a
// schema would collapse them into one undifferentiated parse failure.
const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
})

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

// Which field an error belongs under. The two failures are genuinely about
// different inputs — a wrong current password says nothing about the new one —
// so the action names the field rather than leaving the form to guess and mark
// both. Omitted for the form-level case, which has no field to blame.
export type ChangePasswordError = ActionError & {
  field?: "current" | "new"
}

const setPasswordSchema = z.object({
  newPassword: z.string(),
})

export type SetPasswordInput = z.infer<typeof setPasswordSchema>

// The name is what the navbar chip and /create-project's greeting render, so
// the cap matches what those can show rather than any DB constraint — it lives
// in auth.users' user_metadata, not a table of ours.
const updateDisplayNameSchema = z.object({
  // Absent when Profile is open on its own route (/profile) rather than
  // inside a project — the name is the user's either way, this only says
  // which tree has to be rebuilt to show the new one.
  projectId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
})

export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>

// Inline rename from Profile's header. Supabase scopes updateUser to the
// caller's own session, so there's no ownership check to make here.
export async function updateDisplayName(
  input: UpdateDisplayNameInput
): Promise<ActionError | { success: true }> {
  const parsed = updateDisplayNameSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Names can be up to 80 characters." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    data: { name: parsed.data.name },
  })

  if (error) {
    if (isNetworkError(error)) return networkActionError()
    return { error: "Couldn't save your name. Please try again." }
  }

  // The navbar chip renders from the layout's own getUser(), so a new name
  // only reaches it once this route's tree is rebuilt — revalidate the layout
  // segment, not just this page. Off a project, the chip is rendered by the
  // /profile page itself, and /projects is where the old name would otherwise
  // still be waiting on the way back.
  if (parsed.data.projectId) {
    revalidatePath(`/projects/${parsed.data.projectId}`, "layout")
  } else {
    revalidatePath("/profile")
    revalidatePath("/projects")
  }

  return { success: true }
}

// Signed-in password change, from Profile's "Change password" panel. Distinct
// from app/(auth)/forgot-password's updatePassword, which runs off a recovery
// OTP and has no old password to check — here there's a live session, so the
// current password is the proof of identity.
export async function changePassword(
  input: ChangePasswordInput
): Promise<ChangePasswordError | { success: true }> {
  const parsed = changePasswordSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Something's wrong with those values." }
  }

  const { currentPassword, newPassword } = parsed.data

  // 1. Length first, always — it's the one rule that can be judged without
  //    talking to the auth server at all, so a too-short password is refused
  //    before anything else is spent on it.
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      field: "new",
    }
  }

  // Defensive: the form disables submit until both fields have something, so
  // this is unreachable through the UI — but an empty current password must
  // not fall through to the re-auth call and come back as "not your current
  // password", which would be technically true and completely unhelpful.
  if (!currentPassword) {
    return { error: "Enter your current password.", field: "current" }
  }

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError && isNetworkError(userError)) return networkActionError()

  const email = userData.user?.email
  if (!email) return { error: "You need to be signed in to do that." }

  // 2. Then verify the current password. Supabase has no "verify this
  //    password" call, so re-authenticating is the check. On success it simply
  //    refreshes the same user's session; on failure it leaves the existing
  //    one alone, so a wrong guess can't sign anyone out.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })

  if (signInError) {
    // Same split the auth screens make: a dropped connection must not be
    // reported as a wrong password (see lib/network-error.ts).
    if (isNetworkError(signInError)) return networkActionError()
    return { error: "That's not your current password.", field: "current" }
  }

  // 3. Only now can the two be compared and mean anything. Run earlier, this
  //    check fired whenever the fields simply matched each other — so typing
  //    the same wrong string into both reported "That's already your
  //    password.", asserting something that had never been verified. The
  //    current password is known to be correct by this point, so equality
  //    here really does mean the new one is unchanged.
  if (currentPassword === newPassword) {
    return { error: "Passwords must be different.", field: "new" }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    if (isNetworkError(error)) return networkActionError()
    // Whatever the auth server objected to here, it objected to the *new*
    // password — the current one has already been accepted by this point.
    return { error: error.message, field: "new" }
  }

  // Deliberately no signOut, unlike the recovery flow: that one ends a
  // recovery session so the user re-authenticates, whereas this session was
  // already theirs and stays valid.
  return { success: true }
}

// An OAuth-only user has a verified, authenticated session but no password to
// re-authenticate with. Supabase does not add an email identity when that user
// adds one later, so user_password_states is the durable guard for this path.
export async function setPassword(
  input: SetPasswordInput
): Promise<ChangePasswordError | { success: true }> {
  const parsed = setPasswordSchema.safeParse(input)

  if (!parsed.success) return { error: "Something's wrong with that value." }
  if (parsed.data.newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      field: "new",
    }
  }

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError && isNetworkError(userError)) return networkActionError()
  if (!userData.user) return { error: "You need to be signed in to do that." }

  const { data: passwordState, error: passwordStateError } = await supabase
    .from("user_password_states")
    .select("user_id")
    .maybeSingle()

  if (passwordStateError) {
    if (isNetworkError(passwordStateError)) return networkActionError()
    return { error: "Couldn't check your password status. Please try again." }
  }

  if (passwordState) {
    return { error: "You already have a password.", field: "new" }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })

  if (error) {
    if (isNetworkError(error)) return networkActionError()
    return { error: error.message, field: "new" }
  }

  const { error: insertPasswordStateError } = await supabase
    .from("user_password_states")
    .insert({ user_id: userData.user.id })

  if (insertPasswordStateError) {
    if (isNetworkError(insertPasswordStateError)) return networkActionError()
    return {
      error: "Your password was added, but we couldn't finish setup. Please try again.",
    }
  }

  return { success: true }
}
