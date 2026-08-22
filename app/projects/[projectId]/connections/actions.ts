"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { decryptApiKey } from "@/lib/ai/key-crypto"
import {
  getLinkedInCredentials,
  revokeLinkedInToken,
} from "@/lib/linkedin/oauth"
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
