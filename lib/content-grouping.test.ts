import { describe, expect, it } from "vitest"

import {
  dayKeyForPost,
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

  it("returns no months for a tab with nothing in it", () => {
    expect(groupPostsByMonth([makePost()], "queued", NOW)).toEqual([])
  })
})
