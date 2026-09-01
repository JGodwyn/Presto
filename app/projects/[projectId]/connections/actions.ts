"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { decryptApiKey } from "@/lib/ai/key-crypto"
import {
  getLinkedInCredentials,
  revokeLinkedInToken,
  verifyLinkedInToken,
} from "@/lib/linkedin/oauth"
import { isLivenessCheckDue } from "@/lib/linkedin/liveness"
import { createClient } from "@/lib/supabase/server"

const disconnectSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
})

// Removing a connection. The row goes first and the revocation follows —
// LinkedIn refusing to revoke (or being unreachable) must not leave the user
// looking at an account they just disconnected, and a token this app has
// thrown away is harmless either way.
//
// Connecting itself is not here: it's a browser redirect, so it lives in
// app/api/connections/linkedin/{authorize,callback}/route.ts.
export async function disconnectSocialAccount(
  input: z.infer<typeof disconnectSchema>
): Promise<{ error: string } | { ok: true }> {
  const parsed = disconnectSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't disconnect that account." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "You need to be signed in." }
  }

  // Read the token before deleting the row — it's the only copy, and RLS
  // scopes this to the signed-in user, so someone else's id reads as a row
  // that doesn't exist. This runs on the server, which is the only place
  // allowed to select this column.
  const { data: existing } = await supabase
    .from("social_accounts")
    .select("encrypted_access_token")
    .eq("id", parsed.data.id)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle()

  const { error } = await supabase
    .from("social_accounts")
    .delete()
    .eq("id", parsed.data.id)

  if (error) {
    return { error: "Couldn't disconnect that account. Please try again." }
  }

  const credentials = getLinkedInCredentials()
  if (existing?.encrypted_access_token && credentials) {
    try {
      await revokeLinkedInToken(
        credentials,
        decryptApiKey(existing.encrypted_access_token)
      )
    } catch {
      // A token stored under a rotated or wrong encryption key throws at
      // decrypt (GCM fails loudly by design). The row is already gone, which
      // is what the user asked for; the unrevoked token expires on its own.
    }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/connections`)

  return { ok: true }
}

const checkLivenessSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
})

// Ask LinkedIn whether a stored token is still good, and mark the row if it
// isn't. Called in the background by the Connections page (see
// useConnectionLivenessCheck) — never blocking a render.
//
// "skipped" is the common answer and not a failure: the row was checked
// recently, or is already known dead. The caller only has to do something
// when this comes back `revoked`.
export async function checkSocialAccountLiveness(
  input: z.infer<typeof checkLivenessSchema>
): Promise<
  { error: string } | { ok: true; result: "alive" | "revoked" | "skipped" }
> {
  const parsed = checkLivenessSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't check that connection." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "You need to be signed in." }
  }

  const { data: account } = await supabase
    .from("social_accounts")
    .select("encrypted_access_token, last_checked_at, status")
    .eq("id", parsed.data.id)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle()

  if (!account) return { error: "That connection no longer exists." }

  // The authority on whether this is worth asking LinkedIn — the page runs the
  // same predicate first to avoid a pointless round trip, but a client with a
  // stale copy of it can only ever reach this line, never LinkedIn.
  const due = isLivenessCheckDue(
    {
      status: account.status,
      lastCheckedAt: account.last_checked_at,
    },
    new Date()
  )
  if (!due) return { ok: true, result: "skipped" }

  let accessToken: string
  try {
    accessToken = decryptApiKey(account.encrypted_access_token)
  } catch {
    // A token stored under a rotated or wrong key throws at decrypt (GCM fails
    // loudly by design). That's an app-side problem, not a revocation — the
    // row is left alone rather than blamed on the member.
    return { ok: true, result: "skipped" }
  }

  const liveness = await verifyLinkedInToken(accessToken)

  // Timestamp every completed attempt, including the indeterminate one. The
  // throttle's job is to bound how often this calls LinkedIn, and a LinkedIn
  // outage is exactly when a "didn't count, try again next render" rule would
  // turn every visit into another request.
  const patch: { last_checked_at: string; status?: string } = {
    last_checked_at: new Date().toISOString(),
  }
  if (liveness === "revoked") patch.status = "revoked"

  const { error } = await supabase
    .from("social_accounts")
    .update(patch)
    .eq("id", parsed.data.id)

  if (error) return { error: "Couldn't check that connection." }

  revalidatePath(`/projects/${parsed.data.projectId}/connections`)

  // "unknown" is reported as alive on purpose — see verifyLinkedInToken's
  // fail-open note. Nothing changed, so nothing should be shown to change.
  return { ok: true, result: liveness === "revoked" ? "revoked" : "alive" }
}
