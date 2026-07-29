"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { gateway, generateText } from "ai"
import { z } from "zod"

import { didFallBackOffByok } from "@/lib/ai/generate"
import { encryptApiKey, lastFourOfKey } from "@/lib/ai/key-crypto"
import { createClient } from "@/lib/supabase/server"
import type { UserAiModel, UserAiModelStatus } from "@/types/ai-model"

// Providers whose names don't survive a naive title-case of their gateway
// slug. Anything not listed falls back to capitalizing the slug, so a
// provider added to the gateway tomorrow still shows up looking reasonable
// without a code change here.
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: "OpenAI",
  xai: "xAI",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  perplexity: "Perplexity",
  cohere: "Cohere",
  vertex: "Google Vertex",
  bedrock: "Amazon Bedrock",
  azure: "Azure OpenAI",
}

function providerDisplayName(slug: string): string {
  return PROVIDER_DISPLAY_NAMES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}

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

// The gateway's own catalog, fetched with this app's AI_GATEWAY_API_KEY (not
// the user's — listing models costs nothing and needs no provider
// credentials). Language models only: the same endpoint also returns image,
// embedding, and speech models, none of which can write a post.
async function fetchLanguageModels(): Promise<GatewayModelOption[]> {
  const { models } = await gateway.getAvailableModels()

  return models
    .filter((model) => model.modelType == null || model.modelType === "language")
    .map((model) => ({
      id: model.id,
      name: model.name,
      inputPricePerToken: model.pricing?.input ?? null,
    }))
}

function providerSlugOf(modelId: string): string {
  return modelId.split("/")[0] ?? ""
}

// Runs a genuine, minimal generation on the user's credentials. There's no
// "just check this key" endpoint on the gateway, and more importantly no
// request flag that forbids the gateway from silently falling back to this
// app's own credentials when a user's key fails — so the only trustworthy
// check is to make a real call and then ask, after the fact, whose key paid
// for it. A key that "works" on our credits is a broken key, and is reported
// as one.
async function verifyProviderKey(
  providerSlug: string,
  apiKey: string,
  gatewayModelId: string
): Promise<{ error: string } | { ok: true }> {
  let generationId: string | undefined

  try {
    const result = await generateText({
      model: gatewayModelId,
      providerOptions: { gateway: { byok: { [providerSlug]: [{ apiKey }] } } },
      prompt: "Reply with the single word: ok",
      maxOutputTokens: 1,
    })
    generationId = result.providerMetadata?.gateway?.generationId as string | undefined
  } catch {
    return {
      error: `That key didn't work with ${providerDisplayName(providerSlug)}. Check you copied all of it and that it's still active.`,
    }
  }

  if (await didFallBackOffByok(generationId)) {
    return {
      error: `That key was rejected by ${providerDisplayName(providerSlug)}. Check it's still active and has billing enabled.`,
    }
  }

  return { ok: true }
}

// Cheapest language model the provider offers, used as the target for the
// verification call above — a key check shouldn't cost the user a frontier
// model's per-token rate. Unpriced models sort last rather than first: a
// missing price means unknown, not free.
function cheapestModel(models: GatewayModelOption[]): GatewayModelOption | undefined {
  return [...models].sort((a, b) => {
    const priceA = a.inputPricePerToken == null ? Infinity : Number(a.inputPricePerToken)
    const priceB = b.inputPricePerToken == null ? Infinity : Number(b.inputPricePerToken)
    return priceA - priceB
  })[0]
}

// Populates the modal's first dropdown. No user credentials involved — this
// is just "what can the gateway route to".
export async function listGatewayProviders(): Promise<
  { error: string } | { ok: true; providers: GatewayProviderOption[] }
> {
  let models: GatewayModelOption[]
  try {
    models = await fetchLanguageModels()
  } catch {
    return { error: "Couldn't load the model catalog. Please try again." }
  }

  const counts = new Map<string, number>()
  for (const model of models) {
    const slug = providerSlugOf(model.id)
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1)
  }

  const providers = [...counts.entries()]
    .map(([slug, modelCount]) => ({ slug, name: providerDisplayName(slug), modelCount }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { ok: true, providers }
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

  let allModels: GatewayModelOption[]
  try {
    allModels = await fetchLanguageModels()
  } catch {
    return { error: "Couldn't load the model catalog. Please try again." }
  }

  const models = allModels.filter(
    (model) => providerSlugOf(model.id) === parsed.data.providerSlug
  )
  if (models.length === 0) {
    return { error: "That provider doesn't have any models available right now." }
  }

  const target = cheapestModel(models)!
  const verified = await verifyProviderKey(parsed.data.providerSlug, parsed.data.apiKey, target.id)
  if ("error" in verified) {
    return verified
  }

  return { ok: true, models }
}

const addModelSchema = z.object({
  projectId: z.string().uuid(),
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

  // Re-verified against the model actually being saved, not the cheap one
  // listGatewayModels probed with — a key can be valid for a provider but not
  // entitled to a specific model, and finding that out now beats finding out
  // mid-batch.
  const verified = await verifyProviderKey(
    parsed.data.providerSlug,
    parsed.data.apiKey,
    parsed.data.gatewayModelId
  )
  if ("error" in verified) {
    return verified
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

  revalidatePath(`/projects/${parsed.data.projectId}/connections`)

  return { ok: true, model: mapRow(data) }
}

const deleteModelSchema = z.object({
  projectId: z.string().uuid(),
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

  revalidatePath(`/projects/${parsed.data.projectId}/connections`)

  return { ok: true }
}
