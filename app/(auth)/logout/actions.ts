"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { LOGIN_URL } from "@/lib/auth-routes"
import { createClient } from "@/lib/supabase/server"

// @supabase/ssr's session cookies — `sb-<project-ref>-auth-token`, split
// across `.0`/`.1` suffixes when the session outgrows one cookie. Same rule
// the middleware uses to spot a session cookie (lib/supabase/middleware.ts).
async function clearSessionCookies() {
  const cookieStore = await cookies()

  for (const { name } of cookieStore.getAll()) {
    if (name.startsWith("sb-") && name.includes("auth-token")) {
      cookieStore.delete(name)
    }
  }
}

export async function logout(): Promise<void> {
  await endSession()

  // The final login URL, not the /login stub: an action that redirects at a
  // redirect gets a response the browser follows out from under React. See
  // lib/auth-routes.ts.
  redirect(LOGIN_URL)
}

// Profile's confirmation dialog needs a normal action result, then performs
// the top-level navigation itself. A redirect thrown from a Server Action is
// otherwise observable as a rejected promise in its event handler and was
// incorrectly shown as a failed logout behind the dialog overlay.
export async function logoutForClient(): Promise<void> {
  await endSession()
}

async function endSession() {
  const supabase = await createClient()

  // signOut reports rather than throws, and it can report *without* having
  // cleared anything: on a session whose refresh token is already dead
  // (expired, rotated, revoked elsewhere) it returns that error before it
  // gets as far as removing the stored session. Logging out has to be final
  // either way — someone who asked to leave must not be handed back into the
  // app by a cookie the failed sign-out left behind — so the cookies are
  // cleared by hand in that case.
  const { error } = await supabase.auth.signOut()
  if (error) await clearSessionCookies()
}
