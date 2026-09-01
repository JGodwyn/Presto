import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogle } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import type { LanguageModel } from "ai"

import { providerDisplayName } from "@/lib/ai/provider-names"

// Every provider a user can bring their own key for, and everything the app
// needs to know about talking to one.
//
// This replaced the Vercel AI Gateway, which routed all BYOK traffic through
// a middleman. Two reasons it went:
//
//  1. **BYOK there requires paid credits on *our* gateway account** — we had
//     to pay so that users could pay for their own inference, which is
//     backwards for this app.
//  2. **A middleman can substitute its own credentials.** The gateway silently
//     served free-tier-eligible models on its own account, so a fake key could
//     look valid (see LEARNINGS.md). A direct call has no such path: the key
//     works or the provider says why.
//
// The cost is that each provider needs its own entry below — there's no shared
// catalog to enumerate. Adding one is a package, a `listModels`, and a
// `languageModel`; nothing else in the app changes.

export interface ProviderModel {
  // Prefixed "slug/model" (e.g. "anthropic/claude-sonnet-5"). Kept prefixed so
  // the provider is recoverable from the stored id alone — the DB column and
  // every cross-check downstream already assume that shape.
  id: string
  name: string
}

export interface DirectProvider {
  slug: string
  name: string
  // What the provider's own key looks like, for the modal's placeholder.
  keyHint: string
  // Doubles as key verification: an invalid key fails here, and it costs
  // nothing — no tokens are generated. Throws on failure; callers classify.
  listModels(apiKey: string): Promise<ProviderModel[]>
  // Builds the model to generate with. `modelId` is the bare provider-side id
  // (no "slug/" prefix) — see bareModelId below.
  languageModel(apiKey: string, modelId: string): LanguageModel
}

export function bareModelId(prefixedId: string): string {
  const slash = prefixedId.indexOf("/")
  return slash === -1 ? prefixedId : prefixedId.slice(slash + 1)
}

export function providerSlugOf(prefixedId: string): string {
  const slash = prefixedId.indexOf("/")
  return slash === -1 ? "" : prefixedId.slice(0, slash)
}

const anthropicProvider: DirectProvider = {
  slug: "anthropic",
  name: providerDisplayName("anthropic"),
  keyHint: "sk-ant-…",

  async listModels(apiKey) {
    const client = new Anthropic({ apiKey })
    const models: ProviderModel[] = []

    // Auto-paginates. `display_name` is the human label ("Claude Sonnet 5");
    // `id` is the string the model is actually called with.
    for await (const model of client.models.list({ limit: 100 })) {
      models.push({
        id: `anthropic/${model.id}`,
        name: model.display_name ?? model.id,
      })
    }

    return models
  },

  languageModel(apiKey, modelId) {
    return createAnthropic({ apiKey })(modelId)
  },
}

// OpenAI's /v1/models returns *everything* on the account — embeddings, speech,
// image, moderation, video — and, unlike Anthropic's, publishes no type or
// modality field to filter on. The id is the only signal there is.
//
// Hence two passes: allowlist the text families, then subtract the non-text
// modalities that share those prefixes ("gpt-4o-audio-preview", "gpt-image-1"
// and "gpt-4o-transcribe" all start with "gpt-"). Wrong exclusions are the
// cheaper mistake — an omitted model is merely invisible, while an included
// image model fails at generation time with a baffling provider error.
const OPENAI_TEXT_FAMILY = /^(gpt|chatgpt|codex|o\d)/i
const OPENAI_NON_TEXT =
  /(embedding|moderation|tts|whisper|audio|transcribe|realtime|image|dall-e|sora|video)/i

// OpenAI publishes no display name, so the id is the label. The one cosmetic
// touch is casing the family the way OpenAI itself writes it — "gpt-5.2-mini"
// reads as "GPT-5.2-mini". Nothing else is invented.
export function isOpenAiTextModel(id: string): boolean {
  return OPENAI_TEXT_FAMILY.test(id) && !OPENAI_NON_TEXT.test(id)
}

export function openAiDisplayName(id: string): string {
  return id.replace(/^gpt/i, "GPT").replace(/^chatgpt/i, "ChatGPT")
}

const openAiProvider: DirectProvider = {
  slug: "openai",
  name: providerDisplayName("openai"),
  keyHint: "sk-…",

  async listModels(apiKey) {
    const client = new OpenAI({ apiKey })
    const models: ProviderModel[] = []

    for await (const model of client.models.list()) {
      if (!isOpenAiTextModel(model.id)) continue
      models.push({ id: `openai/${model.id}`, name: openAiDisplayName(model.id) })
    }

    // The endpoint returns them in no useful order, and unlike Anthropic's
    // there are often dozens of dated snapshots.
    return models.sort((a, b) => a.name.localeCompare(b.name))
  },

  languageModel(apiKey, modelId) {
    return createOpenAI({ apiKey })(modelId)
  },
}

// Google publishes no Node SDK for listing, so this is a plain REST call —
// the one provider here not using a vendor SDK. The key goes in the
// x-goog-api-key header rather than Google's documented `?key=` query
// parameter: a credential in a URL ends up in proxy and server logs.
//
// The response carries a `displayName`, which saves prettifying ids the way
// OpenAI's entry has to. It also carries `supportedGenerationMethods`, but see
// GOOGLE_NON_WRITING below — that field is less useful than it first looks.
const GOOGLE_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200"

// `supportedGenerationMethods: ["generateContent"]` describes the *method*, not
// the output modality — Google's image, speech, transcription and music models
// all list it too. So this needs a blocklist after all, and it can't be built
// from modality words in the id: `nano-banana-pro-preview` is image generation
// and `lyria-3-*` is music, neither of which says so in its name. Checked
// against the live catalog rather than reasoned about: 39 models list
// generateContent, of which only 20 can write a post.
const GOOGLE_NON_WRITING =
  /deep-research|computer-use|antigravity|robotics|embedding|tts|transcribe|image|audio|live|nano-banana|lyria/i

export function isGoogleWritingModel(id: string): boolean {
  return !GOOGLE_NON_WRITING.test(id)
}

interface GoogleModel {
  name: string
  displayName?: string
  supportedGenerationMethods?: string[]
}

const googleProvider: DirectProvider = {
  slug: "google",
  name: providerDisplayName("google"),
  keyHint: "AIza…",

  async listModels(apiKey) {
    const response = await fetch(GOOGLE_MODELS_URL, {
      headers: { "x-goog-api-key": apiKey },
    })
    if (!response.ok) {
      // Shaped like the vendor SDKs' errors so keyFailureCopy can classify it
      // by status the same way.
      throw Object.assign(new Error(`Google returned ${response.status}`), {
        status: response.status,
      })
    }

    const { models = [] } = (await response.json()) as { models?: GoogleModel[] }

    return models
      .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
      .filter((model) => isGoogleWritingModel(model.name))
      .map((model) => {
        // The API returns "models/gemini-3.6-flash"; the bare id is what the
        // provider is called with.
        const id = model.name.replace(/^models\//, "")
        return { id: `google/${id}`, name: model.displayName ?? id }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  languageModel(apiKey, modelId) {
    return createGoogle({ apiKey })(modelId)
  },
}

// Groq's API is OpenAI-compatible, so listing reuses the `openai` client
// already installed here, pointed at Groq's base URL — no second SDK for a
// second catalog. Generation still goes through @ai-sdk/groq, which knows the
// provider's own quirks.
const GROQ_BASE_URL = "https://api.groq.com/openai/v1"

// Same problem as OpenAI: the list mixes modalities and publishes no type
// field, so the id is the only signal. Groq's non-text entries are speech
// (whisper, tts) and moderation (llama-guard, prompt-guard) — narrower and
// more stable than OpenAI's, so a blocklist alone is enough here without the
// family allowlist that one needs.
const GROQ_NON_TEXT = /whisper|tts|guard|embed|moderation/i

export function isGroqTextModel(id: string): boolean {
  return !GROQ_NON_TEXT.test(id)
}

const groqProvider: DirectProvider = {
  slug: "groq",
  name: providerDisplayName("groq"),
  keyHint: "gsk_…",

  async listModels(apiKey) {
    const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL })
    const models: ProviderModel[] = []

    for await (const model of client.models.list()) {
      // Groq adds an `active` flag the OpenAI types don't declare; a retired
      // model still appears in the list but can't be called.
      if ((model as { active?: boolean }).active === false) continue
      if (!isGroqTextModel(model.id)) continue
      models.push({ id: `groq/${model.id}`, name: model.id })
    }

    return models.sort((a, b) => a.name.localeCompare(b.name))
  },

  languageModel(apiKey, modelId) {
    return createGroq({ apiKey })(modelId)
  },
}

const PROVIDERS: DirectProvider[] = [
  anthropicProvider,
  googleProvider,
  groqProvider,
  openAiProvider,
]

export function listProviders(): DirectProvider[] {
  return PROVIDERS
}

export function providerFor(slug: string): DirectProvider | undefined {
  return PROVIDERS.find((provider) => provider.slug === slug)
}
