import { describe, expect, it } from "vitest"

import {
  NO_CONTENT_FILTER,
  filterPosts,
  isContentFilterActive,
  nextPlatformFilter,
  parseContentFilter,
  reconcileContentFilter,
  toggleTopicFilter,
  topicsInPosts,
} from "@/lib/content-filter"
import type { Post } from "@/types/post"

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: crypto.randomUUID(),
    projectId: "project",
    platform: "linkedin",
    status: "draft",
    content: "A post.",
    topics: [],
    scheduledFor: null,
    createdAt: new Date().toISOString(),
    isTryout: false,
    publishedAt: null,
    providerPostId: null,
    publishError: null,
    ...overrides,
  }
}

describe("nextPlatformFilter", () => {
  it("cycles all → linkedin → x → tryout → all", () => {
    expect(nextPlatformFilter("all")).toBe("linkedin")
    expect(nextPlatformFilter("linkedin")).toBe("x")
    expect(nextPlatformFilter("x")).toBe("tryout")
    expect(nextPlatformFilter("tryout")).toBe("all")
  })
})

describe("isContentFilterActive", () => {
  it("is inactive only when nothing narrows the page", () => {
    expect(isContentFilterActive(NO_CONTENT_FILTER)).toBe(false)
    expect(isContentFilterActive({ platform: "x", topics: [] })).toBe(true)
    expect(isContentFilterActive({ platform: "all", topics: ["Design"] })).toBe(true)
  })
})

describe("topicsInPosts", () => {
  it("collects the topics actually present, deduped and sorted", () => {
    const posts = [
      makePost({ topics: ["Leadership", "Design"] }),
      makePost({ topics: ["Design"] }),
      makePost({ topics: [] }),
    ]

    expect(topicsInPosts(posts)).toEqual(["Design", "Leadership"])
  })
})

describe("filterPosts", () => {
  const linkedinDesign = makePost({ platform: "linkedin", topics: ["Design"] })
  const xDesign = makePost({ platform: "x", topics: ["Design"] })
  const linkedinLeadership = makePost({
    platform: "linkedin",
    topics: ["Leadership"],
  })
  const untagged = makePost({ platform: "linkedin", topics: [] })
  // A try-out post carries a real platform alongside the flag — the case the
  // platform filter has to read as "Try out" rather than as LinkedIn.
  const tryout = makePost({
    platform: "linkedin",
    topics: ["Design"],
    isTryout: true,
  })
  const posts = [linkedinDesign, xDesign, linkedinLeadership, untagged, tryout]

  it("returns everything when nothing is selected", () => {
    expect(filterPosts(posts, NO_CONTENT_FILTER)).toEqual(posts)
  })

  it("narrows to one platform", () => {
    expect(filterPosts(posts, { platform: "x", topics: [] })).toEqual([xDesign])
  })

  it("keeps try-out posts out of their own platform's results", () => {
    expect(filterPosts(posts, { platform: "linkedin", topics: [] })).toEqual([
      linkedinDesign,
      linkedinLeadership,
      untagged,
    ])
  })

  it("narrows to try-out posts, whatever platform they carry", () => {
    expect(filterPosts(posts, { platform: "tryout", topics: [] })).toEqual([
      tryout,
    ])
  })

  it("ANDs try out with the topics like any other platform", () => {
    expect(
      filterPosts(posts, { platform: "tryout", topics: ["Leadership"] })
    ).toEqual([])
  })

  it("ORs the selected topics among themselves", () => {
    expect(
      filterPosts(posts, { platform: "all", topics: ["Design", "Leadership"] })
    ).toEqual([linkedinDesign, xDesign, linkedinLeadership, tryout])
  })

  it("ANDs the platform with the topics", () => {
    expect(
      filterPosts(posts, { platform: "linkedin", topics: ["Design"] })
    ).toEqual([linkedinDesign])
  })

  it("drops a post with no topics once any topic is selected", () => {
    expect(filterPosts(posts, { platform: "all", topics: ["Design"] })).not.toContain(
      untagged
    )
  })
})

describe("toggleTopicFilter", () => {
  it("adds, removes, and lands back on the empty (all topics) state", () => {
    expect(toggleTopicFilter([], "Design")).toEqual(["Design"])
    expect(toggleTopicFilter(["Design"], "Leadership")).toEqual([
      "Design",
      "Leadership",
    ])
    expect(toggleTopicFilter(["Design"], "Design")).toEqual([])
  })
})

describe("parseContentFilter", () => {
  it("round-trips what setContentFilter stores", () => {
    const filter = { platform: "x" as const, topics: ["Design"] }

    expect(parseContentFilter(JSON.stringify(filter))).toEqual(filter)
  })

  it("returns the shared empty filter for anything unusable", () => {
    // Identity matters, not just equality: useSyncExternalStore re-renders on
    // any change of snapshot identity, so every "nothing selected" read has to
    // be the same object.
    expect(parseContentFilter(null)).toBe(NO_CONTENT_FILTER)
    expect(parseContentFilter("not json")).toBe(NO_CONTENT_FILTER)
    expect(parseContentFilter('"a string"')).toBe(NO_CONTENT_FILTER)
    expect(parseContentFilter("{}")).toBe(NO_CONTENT_FILTER)
    expect(parseContentFilter('{"platform":"all","topics":[]}')).toBe(
      NO_CONTENT_FILTER
    )
  })

  it("restores try out, which is a filter value but not a platform", () => {
    expect(parseContentFilter('{"platform":"tryout","topics":[]}')).toEqual({
      platform: "tryout",
      topics: [],
    })
  })

  it("drops values that aren't part of the filter any more", () => {
    expect(
      parseContentFilter('{"platform":"myspace","topics":["Design",7,null]}')
    ).toEqual({ platform: "all", topics: ["Design"] })
  })
})

describe("reconcileContentFilter", () => {
  it("drops topics no post carries any more", () => {
    const filter = { platform: "linkedin" as const, topics: ["Design", "Gone"] }

    expect(reconcileContentFilter(filter, ["Design"])).toEqual({
      platform: "linkedin",
      topics: ["Design"],
    })
  })

  it("returns the same object when every topic still exists", () => {
    const filter = { platform: "all" as const, topics: ["Design"] }

    expect(reconcileContentFilter(filter, ["Design", "Leadership"])).toBe(filter)
    expect(reconcileContentFilter(NO_CONTENT_FILTER, [])).toBe(NO_CONTENT_FILTER)
  })

  it("collapses to the shared empty filter when nothing is left to narrow by", () => {
    const filter = { platform: "all" as const, topics: ["Gone"] }

    expect(reconcileContentFilter(filter, ["Design"])).toBe(NO_CONTENT_FILTER)
  })
})
