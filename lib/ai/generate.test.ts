import { describe, expect, it } from "vitest"
import { generatePost } from "@/lib/ai/generate"

describe("generatePost", () => {
  it.skipIf(!process.env.GOOGLE_GENERATIVE_AI_API_KEY)(
    "returns generated post content for a basic prompt",
    async () => {
      const result = await generatePost({
        prompt: "Write a short LinkedIn post about the benefits of remote work.",
        // The built-in path — runs on GOOGLE_GENERATIVE_AI_API_KEY directly
        // (which is why the skip guard above covers this test).
        model: { kind: "builtin" },
      })

      expect(result.content).toBeTypeOf("string")
      expect(result.content.length).toBeGreaterThan(0)
    },
    // This makes a real API call, and the free tier is slow: a bare two-token
    // reply measured ~20s, so a whole post regularly ran past the old 30s cap
    // and failed as a timeout rather than on anything about the code.
    90_000,
  )
})
