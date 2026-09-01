import type { SupabaseClient } from "@supabase/supabase-js"

import { BUILTIN_MODEL_ID, TASTE_TEST_MODEL_ID } from "@/lib/ai/model-constants"
import { type ModelSelection } from "@/lib/ai/generate"
import { decryptApiKey } from "@/lib/ai/key-crypto"
import { providerFor } from "@/lib/ai/providers"

// Turns the opaque string the Generate page's model pill puts in the URL into
// something generatePost can actually call. Three cases:
//
//   "tastetest"        → no model call at all (post-actions.ts branches first)
//   "gemini-3.6-flash" → the built-in, on the app's own key
//   <uuid>             → a user_ai_models row id
//
// Not a server action (it takes a SupabaseClient, which can't cross that
// boundary) — it lives here rather than in settings/model-actions.ts for
// that reason alone.
//
// Returns null for a model the user can't use: an id that doesn't exist, or
// one belonging to someone else (RLS makes those indistinguishable, which is
// the point). Callers surface that as "model_unavailable" rather than a
// generic failure, since the fix is to pick a different model.

export type ResolvedModel =
  | { kind: "tastetest" }
  | { selection: ModelSelection; modelRowId?: string }

export async function resolveModelSelection(
  supabase: SupabaseClient,
  model: string
): Promise<ResolvedModel | null> {
  if (model === TASTE_TEST_MODEL_ID) {
    return { kind: "tastetest" }
  }

  if (model === BUILTIN_MODEL_ID) {
    return { selection: { kind: "builtin" } }
  }

  // The one place encrypted_key is ever read. RLS scopes this to the signed-in
  // user, so no explicit user_id filter is needed (same contract as
  // lib/supabase/queries.ts).
  const { data, error } = await supabase
    .from("user_ai_models")
    .select("id, provider_slug, gateway_model_id, encrypted_key")
    .eq("id", model)
    .maybeSingle()

  if (error || !data) return null

  // A row can outlive its provider — added while Groq was in the registry,
  // read back after it was removed. modelFor() throws on an unknown slug, which
  // surfaced as a 500 from the regenerate route; returning null here routes it
  // to the same "model_unavailable" copy as a deleted model, which is what the
  // user can actually act on.
  if (!providerFor(data.provider_slug)) return null

  let apiKey: string
  try {
    apiKey = decryptApiKey(data.encrypted_key)
  } catch {
    // A key we can't decrypt (tampered row, or MODEL_KEY_ENCRYPTION_KEY
    // rotated without migrating) is unusable — surfaced as an unavailable
    // model so the user re-adds it, rather than as a mystery API error.
    return null
  }

  return {
    selection: {
      kind: "byok",
      gatewayModelId: data.gateway_model_id,
      providerSlug: data.provider_slug,
      apiKey,
    },
    modelRowId: data.id,
  }
}
