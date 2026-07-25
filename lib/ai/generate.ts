import { google } from "@ai-sdk/google"
import { generateText } from "ai"
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
