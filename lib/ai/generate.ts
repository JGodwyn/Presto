import { google } from "@ai-sdk/google"
import { APICallError, generateText, RetryError } from "ai"
import { z } from "zod"

// "tastetest" is the free, no-API-call stand-in (lib/ai/taste-test.ts) —
// post-actions.ts branches on this instead of calling generatePost below.
// Kept here (not a UI file) since this is the one list every layer of the
// generate flow validates against — generate-card.tsx's MODEL_OPTIONS labels
// are kept in sync with these values by hand.
export const GENERATION_MODELS = ["gemini-3.6-flash", "tastetest"] as const
export type GenerationModel = (typeof GENERATION_MODELS)[number]

export const generatePostInputSchema = z.object({
  prompt: z.string().min(1),
})

export type GeneratePostInput = z.infer<typeof generatePostInputSchema>

export interface GeneratePostResult {
  content: string
}

export async function generatePost(input: GeneratePostInput): Promise<GeneratePostResult> {
  const { text } = await generateText({
    model: google("gemini-3.6-flash"),
    prompt: input.prompt,
  })

  return { content: text }
}

// What post-actions.ts uses to pick a more specific total-failure message
// than a generic "please try again" — "missing_instructions"/"not_signed_in"
// are added there (they're not generatePost failures at all); everything
// below comes from classifyGenerationError.
export type GenerationFailureReason =
  | "missing_instructions"
  | "not_signed_in"
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
