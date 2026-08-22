import { describe, expect, it } from "vitest"

import {
  dayKeyForPost,
  filterPostsByQuery,
  groupPostsByMonth,
  postsForTab,
} from "@/lib/content-grouping"
import type { Post } from "@/types/post"

const NOW = new Date(2026, 6, 30, 12, 0, 0).getTime() // 30 July 2026, local

// Built from local date parts on purpose: grouping reads local dates (a
// scheduled day is picked in the user's own timezone), so a test written
// against fixed UTC strings would drift with the runner's timezone.
function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString()
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: crypto.randomUUID(),
    projectId: "project",
    platform: "linkedin",
    status: "draft",
    content: "A post.",
    topics: [],
    scheduledFor: null,
    createdAt: localIso(2026, 7, 30),
    ...overrides,
  }
}

describe("postsForTab", () => {
  it("splits by date, not by the post's own status column", () => {
    // Every post here is status: "draft" — only the dates differ.
    const future = makePost({ scheduledFor: localIso(2026, 8, 3) })
    const past = makePost({ scheduledFor: localIso(2026, 7, 1) })
    const undated = makePost({ scheduledFor: null })
    const posts = [future, past, undated]

    expect(postsForTab(posts, "queued", NOW)).toEqual([future])
    expect(postsForTab(posts, "published", NOW)).toEqual([past])
    expect(postsForTab(posts, "draft", NOW)).toEqual([undated])
  })

  it("counts a post scheduled for exactly now as still queued", () => {
    const post = makePost({ scheduledFor: new Date(NOW).toISOString() })

    expect(postsForTab([post], "queued", NOW)).toEqual([post])
    expect(postsForTab([post], "published", NOW)).toEqual([])
  })
})

describe("filterPostsByQuery", () => {
  const culture = makePost({ content: "Company CULTURE isn't the snacks." })
  const freelancing = makePost({ content: "Freelancing taught me a lot." })
  const posts = [culture, freelancing]

  it("matches the post's content, ignoring case and surrounding whitespace", () => {
    expect(filterPostsByQuery(posts, "  culture ")).toEqual([culture])
    expect(filterPostsByQuery(posts, "SNACKS")).toEqual([culture])
    expect(filterPostsByQuery(posts, "taught")).toEqual([freelancing])
  })

  it("returns everything for an empty or whitespace-only query", () => {
    expect(filterPostsByQuery(posts, "")).toEqual(posts)
    expect(filterPostsByQuery(posts, "   ")).toEqual(posts)
  })

  it("does not match on topics, platform or date", () => {
    const tagged = makePost({
      content: "Nothing relevant here.",
      topics: ["Design"],
      platform: "linkedin",
    })

    expect(filterPostsByQuery([tagged], "Design")).toEqual([])
    expect(filterPostsByQuery([tagged], "linkedin")).toEqual([])
  })

  it("returns nothing when the query matches no post", () => {
    expect(filterPostsByQuery(posts, "kubernetes")).toEqual([])
  })
})

describe("dayKeyForPost", () => {
  it("matches the key of the group the post actually lands in", () => {
    const post = makePost({ scheduledFor: localIso(2026, 8, 3) })
    const [month] = groupPostsByMonth([post], "queued", NOW)

    expect(dayKeyForPost(post, "queued", NOW)).toBe(month.days[0].key)
  })

  it("returns null for a post that isn't on the tab at all", () => {
    const draft = makePost({ scheduledFor: null })

    expect(dayKeyForPost(draft, "queued", NOW)).toBeNull()
    expect(dayKeyForPost(draft, "draft", NOW)).not.toBeNull()
  })

  it("changes key when a date moves the post to another day, and holds when it doesn't", () => {
    const post = makePost({ scheduledFor: localIso(2026, 8, 3, 9) })
    const key = dayKeyForPost(post, "queued", NOW)

    // Same calendar day, different time — still the same deck.
    expect(dayKeyForPost({ ...post, scheduledFor: localIso(2026, 8, 3, 21) }, "queued", NOW)).toBe(key)
    // Next day, and dropping the date entirely, both leave it.
    expect(dayKeyForPost({ ...post, scheduledFor: localIso(2026, 8, 4) }, "queued", NOW)).not.toBe(key)
    expect(dayKeyForPost({ ...post, scheduledFor: null }, "queued", NOW)).toBeNull()
  })
})

describe("groupPostsByMonth", () => {
  it("collapses a day's posts into one entry and orders queued months forwards", () => {
    const posts = [
      makePost({ scheduledFor: localIso(2026, 8, 3) }),
      makePost({ scheduledFor: localIso(2026, 7, 31) }),
      makePost({ scheduledFor: localIso(2026, 7, 31, 18) }),
    ]

    const months = groupPostsByMonth(posts, "queued", NOW)

    expect(months.map((month) => month.label)).toEqual(["July 2026", "August 2026"])
    expect(months[0].days).toHaveLength(1)
    expect(months[0].days[0].day).toBe(31)
    expect(months[0].days[0].posts).toHaveLength(2)
  })

  it("orders published months and days newest-first", () => {
    const posts = [
      makePost({ scheduledFor: localIso(2026, 5, 4) }),
      makePost({ scheduledFor: localIso(2026, 7, 2) }),
      makePost({ scheduledFor: localIso(2026, 7, 20) }),
    ]

    const months = groupPostsByMonth(posts, "published", NOW)

    expect(months.map((month) => month.label)).toEqual(["July 2026", "May 2026"])
    expect(months[0].days.map((day) => day.day)).toEqual([20, 2])
  })

  it("groups drafts by their created date, ignoring any scheduled date entirely", () => {
    const posts = [
      makePost({ scheduledFor: null, createdAt: localIso(2026, 7, 28) }),
      makePost({ scheduledFor: null, createdAt: localIso(2026, 7, 30) }),
    ]

    const months = groupPostsByMonth(posts, "draft", NOW)

    expect(months).toHaveLength(1)
    expect(months[0].days.map((day) => day.day)).toEqual([30, 28])
  })

  it("puts the most recently created post first within a day, on every tab", () => {
    const older = makePost({
      scheduledFor: localIso(2026, 8, 3),
      createdAt: localIso(2026, 7, 28),
    })
    const newer = makePost({
      scheduledFor: localIso(2026, 8, 3),
      createdAt: localIso(2026, 7, 30),
    })

    // Queued reads its *days* forwards, but a day's own posts still lead with
    // the newest — otherwise a freshly generated post lands out of sight at
    // the bottom of a busy day.
    const queued = groupPostsByMonth([older, newer], "queued", NOW)
    expect(queued[0].days[0].posts).toEqual([newer, older])

    const drafts = [
      makePost({ scheduledFor: null, createdAt: localIso(2026, 7, 30, 9) }),
      makePost({ scheduledFor: null, createdAt: localIso(2026, 7, 30, 17) }),
    ]
    const draft = groupPostsByMonth(drafts, "draft", NOW)
    expect(draft[0].days[0].posts).toEqual([drafts[1], drafts[0]])
  })

  it("returns no months for a tab with nothing in it", () => {
    expect(groupPostsByMonth([makePost()], "queued", NOW)).toEqual([])
  })
})
