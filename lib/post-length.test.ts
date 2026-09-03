import { describe, expect, it } from "vitest"

import { exceedsPlatformLimit, postLengthStatus } from "@/lib/post-length"

const within = "a".repeat(280)
const over = "a".repeat(281)

describe("postLengthStatus", () => {
  it("reports a post exactly at the limit as within it", () => {
    // 280 is allowed; the limit is inclusive, and an off-by-one here would flag
    // a perfectly postable post.
    expect(postLengthStatus(within, "x")).toEqual({
      count: 280,
      limit: 280,
      over: false,
      excess: 0,
    })
  })

  it("reports how far over a long post is", () => {
    expect(postLengthStatus(over, "x")).toEqual({
      count: 281,
      limit: 280,
      over: true,
      excess: 1,
    })
  })

  it("has nothing to say about LinkedIn", () => {
    // Its 3,000-character ceiling never binds on what this app generates, so a
    // counter there would be permanent noise.
    expect(postLengthStatus(over, "linkedin")).toBeNull()
  })

  it("ignores surrounding whitespace", () => {
    // Trailing newlines from an edit box are not something a user counts, and X
    // strips them anyway.
    expect(postLengthStatus(`\n  ${within}  \n`, "x")?.over).toBe(false)
  })

  it("counts an empty post as zero rather than returning null", () => {
    expect(postLengthStatus("", "x")).toEqual({
      count: 0,
      limit: 280,
      over: false,
      excess: 0,
    })
  })
})

describe("exceedsPlatformLimit", () => {
  it("answers the question the account switch asks", () => {
    expect(exceedsPlatformLimit(over, "x")).toBe(true)
    expect(exceedsPlatformLimit(within, "x")).toBe(false)
  })

  it("is false for a platform with no limit, never null", () => {
    // The switch handler branches on this directly, so it must be a boolean —
    // a null here would read as falsy by accident rather than by decision.
    expect(exceedsPlatformLimit(over, "linkedin")).toBe(false)
  })
})
