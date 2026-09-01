"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { listProviders, providerFor, providerSlugOf } from "@/lib/ai/providers"
import { isNetworkError } from "@/lib/network-error"
import { encryptApiKey, lastFourOfKey } from "@/lib/ai/key-crypto"
import { createClient } from "@/lib/supabase/server"
import type { UserAiModel, UserAiModelStatus } from "@/types/ai-model"

export interface GatewayModelOption {
  id: string
  name: string
  // USD per input token, as the gateway reports it. Kept as the raw string so
  // the UI decides its own formatting; null when the gateway doesn't publish
  // pricing for the model.
  inputPricePerToken: string | null
}

export interface GatewayProviderOption {
  slug: string
  name: string
  modelCount: number
  // What this provider's key looks like, for the field's placeholder. Carried
  // through the action rather than imported: lib/ai/providers.ts pulls in the
  // vendor SDKs, so a client component can't read it directly.
  keyHint: string
}

type UserAiModelRow = {
  id: string
  label: string
  provider_slug: string
  gateway_model_id: string
  key_last_four: string
  status: UserAiModelStatus
  last_error: string | null
  created_at: string
}

function mapRow(row: UserAiModelRow): UserAiModel {
  return {
    id: row.id,
    label: row.label,
    providerSlug: row.provider_slug,
    gatewayModelId: row.gateway_model_id,
    keyLastFour: row.key_last_four,
    status: row.status,
    lastError: row.last_error,
    createdAt: row.created_at,
  }
}

const SELECT_COLUMNS =
  "id, label, provider_slug, gateway_model_id, key_last_four, status, last_error, created_at"

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// Turns a provider-SDK failure into copy that names the actual problem. The
// providers' SDKs throw their own error classes, so this reads statusCode and
// message defensively rather than gating on any one instance check — the trap
// that made the old gateway classifier match nothing (see LEARNINGS.md).
function keyFailureCopy(error: unknown, providerName: string): string {
  // Checked first: a request that never arrived says nothing about the key, and
  // telling someone to re-copy a perfectly good key because their wifi dropped
  // sends them to fix the wrong thing.
  if (isNetworkError(error)) {
    return `Couldn't reach ${providerName}. Check your connection and try again.`
  }

  const target = error as { status?: unknown; statusCode?: unknown; message?: unknown } | undefined
  const status =
    typeof target?.status === "number"
      ? target.status
      : typeof target?.statusCode === "number"
        ? target.statusCode
        : undefined
  const detail = typeof target?.message === "string" ? target.message : ""

  if (status === 401 || status === 403) {
    return `${providerName} rejected that key. Check you copied all of it and that it's still active.`
  }
  if (status === 429) {
    return `${providerName} is rate limiting that key. Wait a moment and try again.`
  }
  if (/credit|balance|billing|insufficient|payment|fund/i.test(detail)) {
    return `That key works, but the ${providerName} account behind it has no credit. Add billing on ${providerName}, then try again.`
  }
  return `That key didn't work with ${providerName}. Check you copied all of it and that it's still active.`
}

// Populates the modal's first dropdown. Now a local list rather than a network
// call — the app supports exactly the providers lib/ai/providers.ts implements,
// so there is nothing to fetch and nothing to fail. modelCount is 0 because a
// provider's catalog isn't knowable until a key is pasted (that's what step two
// is for); the UI doesn't render it.
export async function listGatewayProviders(): Promise<
  { error: string } | { ok: true; providers: GatewayProviderOption[] }
> {
  return {
    ok: true,
    providers: listProviders()
      .map((provider) => ({
        slug: provider.slug,
        name: provider.name,
        modelCount: 0,
        keyHint: provider.keyHint,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

const listModelsSchema = z.object({
  providerSlug: z.string().trim().min(1).max(60),
  apiKey: z.string().trim().min(1).max(500),
})

// Step two of the modal: validate the pasted key *and* hand back the models
// it unlocks, in one round trip — there's no point showing a model list for a
// key that doesn't work.
export async function listGatewayModels(
  input: z.infer<typeof listModelsSchema>
): Promise<{ error: string } | { ok: true; models: GatewayModelOption[] }> {
  const parsed = listModelsSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Paste your API key before continuing." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to add a model." }
  }

  const provider = providerFor(parsed.data.providerSlug)
  if (!provider) {
    return { error: "That provider isn't supported yet." }
  }

  // Listing *is* the key check, and it's free — a bad key fails here with the
  // provider's own 401 and no tokens are generated. The old gateway path had
  // to burn a real one-token generation to learn the same thing, because it
  // had no per-key catalog endpoint to ask.
  let models: GatewayModelOption[]
  try {
    models = (await provider.listModels(parsed.data.apiKey)).map((model) => ({
      id: model.id,
      name: model.name,
      // Providers don't publish per-model pricing on their model endpoints the
      // way the gateway catalog did. The combobox already renders the price
      // column only when it's set.
      inputPricePerToken: null,
    }))
  } catch (error) {
    return { error: keyFailureCopy(error, provider.name) }
  }

  if (models.length === 0) {
    return { error: `That key doesn't have access to any ${provider.name} models.` }
  }

  return { ok: true, models }
}

// Where the Profile screen lives for this caller — inside a project, or on
// its own route.
function revalidateProfile(projectId: string | undefined) {
  revalidatePath(projectId ? `/projects/${projectId}/profile` : "/profile")
}

// projectId is optional on both of these for the same reason it is on
// updateDisplayName: a model belongs to the user, not a project, and the id
// only picks which copy of the Profile screen to rebuild — the in-project one
// or the standalone /profile route.
const addModelSchema = z.object({
  projectId: z.string().uuid().optional(),
  providerSlug: z.string().trim().min(1).max(60),
  gatewayModelId: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(60),
  apiKey: z.string().trim().min(1).max(500),
})

export async function addUserAiModel(
  input: z.infer<typeof addModelSchema>
): Promise<{ error: string } | { ok: true; model: UserAiModel }> {
  const parsed = addModelSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Pick a model and give it a name before saving." }
  }

  if (providerSlugOf(parsed.data.gatewayModelId) !== parsed.data.providerSlug) {
    return { error: "That model doesn't belong to the provider you picked." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to add a model." }
  }

  const provider = providerFor(parsed.data.providerSlug)
  if (!provider) {
    return { error: "That provider isn't supported yet." }
  }

  // Re-listed rather than re-generated: it re-proves the key still works and
  // confirms the chosen model is one this key can actually see, without
  // spending anything on the user's account. Deliberately *not* a trial
  // generation — that would charge them to save a row, and would reject a
  // valid key on an unfunded account, which is a billing problem to discover
  // at generation time rather than a reason to refuse to store the key.
  let available: string[]
  try {
    available = (await provider.listModels(parsed.data.apiKey)).map((model) => model.id)
  } catch (error) {
    return { error: keyFailureCopy(error, provider.name) }
  }

  if (!available.includes(parsed.data.gatewayModelId)) {
    return { error: `That key can't access ${parsed.data.gatewayModelId}.` }
  }

  const { data, error } = await supabase
    .from("user_ai_models")
    .insert({
      user_id: user.id,
      label: parsed.data.label,
      provider_slug: parsed.data.providerSlug,
      gateway_model_id: parsed.data.gatewayModelId,
      encrypted_key: encryptApiKey(parsed.data.apiKey),
      key_last_four: lastFourOfKey(parsed.data.apiKey),
    })
    .select(SELECT_COLUMNS)
    .single()

  if (error || !data) {
    // The one insert failure worth naming: the (user_id, gateway_model_id)
    // unique constraint, i.e. they already added this exact model.
    if (error?.code === "23505") {
      return { error: "You've already added that model." }
    }
    return { error: "Couldn't save that model. Please try again." }
  }

  revalidateProfile(parsed.data.projectId)

  return { ok: true, model: mapRow(data) }
}

const deleteModelSchema = z.object({
  projectId: z.string().uuid().optional(),
  id: z.string().uuid(),
})

export async function deleteUserAiModel(
  input: z.infer<typeof deleteModelSchema>
): Promise<{ error: string } | { ok: true }> {
  const parsed = deleteModelSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't remove that model." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in." }
  }

  const { error } = await supabase.from("user_ai_models").delete().eq("id", parsed.data.id)

  if (error) {
    return { error: "Couldn't remove that model. Please try again." }
  }

  revalidateProfile(parsed.data.projectId)

  return { ok: true }
}
