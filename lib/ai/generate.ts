import { google } from "@ai-sdk/google"
import { APICallError, gateway, generateText, RetryError, type ToolSet } from "ai"
import { z } from "zod"

// The two models that need no setup from the user. "tastetest" is the free,
// no-API-call stand-in (lib/ai/taste-test.ts) — post-actions.ts branches on
// this instead of calling generatePost below; "gemini-3.6-flash" runs on the
// app's own GOOGLE_GENERATIVE_AI_API_KEY. Anything else the model pill offers
// is a user_ai_models row id (see resolveModelSelection in
// connections/model-actions.ts), so this is no longer the complete list of
// valid values — just the ones with no database row behind them.
export const BUILTIN_MODELS = ["gemini-3.6-flash", "tastetest"] as const
export type BuiltinModel = (typeof BUILTIN_MODELS)[number]

export const BUILTIN_MODEL_ID: BuiltinModel = "gemini-3.6-flash"
export const TASTE_TEST_MODEL_ID: BuiltinModel = "tastetest"

// What generatePost actually needs to make a call, after post-actions.ts has
// turned the pill's opaque string into either a built-in or a decrypted
// user-owned credential.
export type ModelSelection =
  | { kind: "builtin" }
  | {
      kind: "byok"
      // e.g. "google/gemini-3.6-flash" — a plain "creator/model" string is
      // what routes a generateText call through the AI Gateway.
      gatewayModelId: string
      // e.g. "google" — the key the credential is passed under below.
      providerSlug: string
      apiKey: string
    }

export const generatePostInputSchema = z.object({
  prompt: z.string().min(1),
  // "My writing style"/"References" file-kind entries, resolved (downloaded
  // + base64-encoded) by lib/ai/attachments.ts before reaching here — sent
  // as inline file parts so Gemini's native document understanding reads
  // them directly, no PDF/DOCX parsing library needed.
  fileParts: z
    .array(
      z.object({
        mediaType: z.string(),
        data: z.string(),
        filename: z.string().optional(),
      })
    )
    .optional(),
  // Set whenever any writing-style/reference entry is a "url" kind — lets
  // Gemini fetch and read the URL(s) mentioned in the prompt text itself
  // (lib/ai/build-prompt.ts just writes the URL into the text; this tool is
  // what actually resolves it).
  useUrlContext: z.boolean().optional(),
})

export type GeneratePostInput = z.infer<typeof generatePostInputSchema> & {
  model: ModelSelection
}

export interface GeneratePostResult {
  content: string
  // Only set on BYOK calls, and only when the gateway reported one — the
  // handle post-actions.ts uses to check the call actually ran on the user's
  // credentials (see didFallBackOffByok below).
  generationId?: string
}

export async function generatePost(input: GeneratePostInput): Promise<GeneratePostResult> {
  const byok = input.model.kind === "byok" ? input.model : null

  const { text, providerMetadata } = await generateText({
    // A provider instance (built-in) or a plain "creator/model" string, which
    // the AI SDK routes through the AI Gateway automatically. The gateway
    // itself is authed by AI_GATEWAY_API_KEY; the credential below is what
    // the *upstream provider* bills, so the user pays for their own model.
    model: byok ? byok.gatewayModelId : google(BUILTIN_MODEL_ID),
    providerOptions: byok
      ? { gateway: { byok: { [byok.providerSlug]: [{ apiKey: byok.apiKey }] } } }
      : undefined,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: input.prompt },
          ...(input.fileParts ?? []).map((part) => ({
            type: "file" as const,
            data: part.data,
            mediaType: part.mediaType,
            filename: part.filename,
          })),
        ],
      },
    ],
    // The cast is a real gap in @ai-sdk/google's own types, not a runtime
    // concern: ToolSet's declared shape requires 'execute'/'onInputAvailable'/
    // etc. as own properties, but a provider-executed tool (isProviderExecuted:
    // true — Google's own backend runs it, nothing local ever calls execute)
    // structurally doesn't carry those, and the package doesn't narrow ToolSet
    // to account for that. This is exactly google.tools.urlContext()'s
    // documented purpose and shape (verified by reading the installed
    // package's source, not assumed) — the mismatch is the .d.ts, not this call.
    tools: input.useUrlContext
      ? ({ url_context: google.tools.urlContext({}) } as ToolSet)
      : undefined,
  })

  return {
    content: text,
    generationId: providerMetadata?.gateway?.generationId as string | undefined,
  }
}

// The AI Gateway treats request-scoped BYOK credentials as a preference, not
// a requirement: its own docs say a request "may still fall back to use
// system credentials if the provided credentials fail". That fallback is
// silent and would quietly bill *this app's* gateway account for a user whose
// key has expired or been revoked. There's no request flag to forbid it, so
// the only way to catch it is after the fact — getGenerationInfo reports
// whether the call actually ran on BYOK credentials.
//
// Best-effort by design: an unknown result (no generation id, or the lookup
// itself failing) returns false, i.e. "no evidence of a fallback", since
// flipping a working model to an error state on a flaky metadata call would
// be worse than missing one.
export async function didFallBackOffByok(generationId: string | undefined): Promise<boolean> {
  if (!generationId) return false

  try {
    const info = await gateway.getGenerationInfo({ id: generationId })
    return info.isByok === false
  } catch {
    return false
  }
}

// What post-actions.ts uses to pick a more specific total-failure message
// than a generic "please try again" — "missing_instructions"/"not_signed_in"
// are added there (they're not generatePost failures at all); everything
// below comes from classifyGenerationError.
export type GenerationFailureReason =
  | "missing_instructions"
  | "not_signed_in"
  | "model_unavailable"
  | "rate_limit"
  | "auth"
  | "server"
  | "network"
  | "unknown"

// Unwraps a RetryError (generateText retries transient failures internally
// — see node_modules/ai/docs/.../ai-retry-error.mdx — and only surfaces this
// wrapper once every attempt has failed) down to the underlying APICallError
// it wraps, then classifies by HTTP status: 429 is a quota/rate-limit hit,
// 401/403 an API key problem, 5xx the model's own service having trouble.
// A plain TypeError (no statusCode at all — the request never got a
// response) means the request never reached the model, i.e. a real network
// problem on this end.
export function classifyGenerationError(error: unknown): GenerationFailureReason {
  const target = RetryError.isInstance(error) ? error.lastError : error

  if (APICallError.isInstance(target)) {
    if (target.statusCode === 429) return "rate_limit"
    if (target.statusCode === 401 || target.statusCode === 403) return "auth"
    if (target.statusCode && target.statusCode >= 500) return "server"
    return "unknown"
  }

  if (
    target instanceof TypeError ||
    (target instanceof Error && /fetch failed|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(target.message))
  ) {
    return "network"
  }

  return "unknown"
}
