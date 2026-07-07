import { z } from "zod"

// TODO: wire up a real provider (e.g. @ai-sdk/openai or @ai-sdk/anthropic) once
// the Generate page spec is available and a model choice is confirmed. This
// file just defines the shape callers will use so the Generate page can be
// built against a stable interface.

export const generatePostInputSchema = z.object({
  prompt: z.string().min(1),
})

export type GeneratePostInput = z.infer<typeof generatePostInputSchema>

export async function generatePost(_input: GeneratePostInput): Promise<never> {
  throw new Error("generatePost is not implemented yet")
}
