import { APICallError, RetryError } from "ai"
import { describe, expect, it } from "vitest"

import { generationFailureCopy } from "@/lib/ai/failure-copy"
import { classifyGenerationError, STREAM_ERROR_MARKER } from "@/lib/ai/generate"

const FALLBACK = { message: "Couldn't regenerate that post", extraInfo: "Please try again" }

function quotaError() {
  // What a provider actually sends when the account is out of quota: a 429
  // that the AI SDK wraps, and retries, before surfacing it.
  return new RetryError({
    message: "Failed after 3 attempts",
    reason: "maxRetriesExceeded",
    errors: [
      new APICallError({
        message:
          "You exceeded your current quota, please check your plan and billing details.",
        url: "https://example.test/v1/generate",
        requestBodyValues: {},
        statusCode: 429,
      }),
    ],
  })
}

describe("generation failure copy", () => {
  it("names a quota hit rather than blaming the app", () => {
    const copy = generationFailureCopy(classifyGenerationError(quotaError()), FALLBACK)

    expect(copy).toEqual({
      message: "You exceeded your model quota",
      extraInfo: "Try again later",
    })
  })

  it("keeps the call site's own line for everything else", () => {
    const serverError = new APICallError({
      message: "upstream exploded",
      url: "https://example.test/v1/generate",
      requestBodyValues: {},
      statusCode: 503,
    })

    expect(generationFailureCopy(classifyGenerationError(serverError), FALLBACK)).toEqual(
      FALLBACK
    )
    expect(generationFailureCopy(undefined, FALLBACK)).toEqual(FALLBACK)
    // A reason off the regenerate stream is just text — an unknown one must
    // fall back rather than produce an empty toast.
    expect(generationFailureCopy("not-a-reason", FALLBACK)).toEqual(FALLBACK)
  })

  // How the reason reaches post-details.tsx: written directly behind the
  // stream's error marker by app/api/regenerate-post/route.ts.
  it("survives the round trip through the stream's error marker", () => {
    const streamed = `half a post${STREAM_ERROR_MARKER}rate_limit`
    const reason = streamed.split(STREAM_ERROR_MARKER)[1]?.trim() || undefined

    expect(generationFailureCopy(reason, FALLBACK).message).toBe(
      "You exceeded your model quota"
    )

    // A failure that wasn't the model's writes the marker with nothing after
    // it, and must still report something.
    const bare = `half a post${STREAM_ERROR_MARKER}`
    expect(
      generationFailureCopy(bare.split(STREAM_ERROR_MARKER)[1]?.trim() || undefined, FALLBACK)
    ).toEqual(FALLBACK)
  })
})
