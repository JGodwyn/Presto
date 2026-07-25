import { describe, expect, it } from "vitest"
import { generatePost } from "@/lib/ai/generate"

describe("generatePost", () => {
  it.skipIf(!process.env.GOOGLE_GENERATIVE_AI_API_KEY)(
    "returns generated post content for a basic prompt",
    async () => {
      const result = await generatePost({
        prompt: "Write a short LinkedIn post about the benefits of remote work.",
      })

      expect(result.content).toBeTypeOf("string")
      expect(result.content.length).toBeGreaterThan(0)
    },
    30000,
  )
})
