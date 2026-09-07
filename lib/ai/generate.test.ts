import { describe, expect, it } from "vitest"
import { generatePost } from "@/lib/ai/generate"

// **Opt-in, not key-gated.** This makes a real, billed call against the Gemini
// free tier, and it used to be guarded only by "is there an API key?" — which is
// always true, because the key lives in `.env.local` and vitest loads it. So it
// ran on every `npm test` and every `/handoff` gate, and once the tier's 20
// requests were spent it failed the *whole* suite with a quota error that looks
// nothing like the code being wrong:
//
//   Quota exceeded for metric: generate_content_free_tier_requests, limit: 20
//
// Spending quota is a thing to ask for, so it now needs saying out loud:
//
//   PRESTO_LIVE_AI_TEST=1 npx vitest run lib/ai/generate.test.ts
//
// The key check is kept as well — the flag alone cannot make the call work.
const liveAiTestEnabled =
  process.env.PRESTO_LIVE_AI_TEST === "1" &&
  Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)

describe("generatePost", () => {
  it.skipIf(!liveAiTestEnabled)(
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
