import { describe, expect, it } from "vitest"

import {
  belongsToTab,
  CONTENT_TABS,
  dayKeyForPost,
  filterPostsByQuery,
  hasFailed,
  isOverdue,
  groupPostsByMonth,
  postsForTab,
} from "@/lib/content-grouping"
import type { Post } from "@/types/post"

const NOW = new Date(2026, 6, 30, 12, 0, 0).getTime() // 30 July 2026, local

// Built from local date parts on purpose: grouping reads local dates (a
// scheduled day is picked in the user's own timezone), so a test written
// against fixed UTC strings would drift with the runner's timezone.
function localIso(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0
): string {
  return new Date(year, month - 1, day, hour, minute).toISOString()
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
    isTryout: false,
    publishedAt: null,
    providerPostId: null,
    publishError: null,
    ...overrides,
  }
}

describe("postsForTab", () => {
  it("puts a post on Published only once it has actually gone out", () => {
    // Every post here is status: "draft" — the status column is not consulted.
    const queued = makePost({ scheduledFor: localIso(2026, 8, 3) })
    const published = makePost({
      scheduledFor: localIso(2026, 7, 1),
      publishedAt: localIso(2026, 7, 1),
      providerPostId: "urn:li:share:1",
    })
    const undated = makePost({ scheduledFor: null })
    const posts = [queued, published, undated]

    expect(postsForTab(posts, "queued")).toEqual([queued])
    expect(postsForTab(posts, "published")).toEqual([published])
    expect(postsForTab(posts, "draft")).toEqual([undated])
  })

  // The bug this whole rule replaced: the date passing was taken as proof the
  // post went out, so a post that never published was indistinguishable from
  // one that did.
  it("keeps a post whose date has passed in Queued when it never published", () => {
    const overdue = makePost({ scheduledFor: localIso(2026, 7, 1) })

    expect(postsForTab([overdue], "queued")).toEqual([overdue])
    expect(postsForTab([overdue], "published")).toEqual([])
  })

  it("counts a post published without ever being scheduled as published, not a draft", () => {
    const post = makePost({
      scheduledFor: null,
      publishedAt: localIso(2026, 7, 20),
      providerPostId: "urn:li:share:2",
    })

    expect(postsForTab([post], "published")).toEqual([post])
    expect(postsForTab([post], "draft")).toEqual([])
  })

  it("puts every post on exactly one tab", () => {
    const posts = [
      makePost({ scheduledFor: localIso(2026, 8, 3) }),
      makePost({ scheduledFor: localIso(2026, 7, 1) }),
      makePost({ scheduledFor: null }),
      makePost({ publishedAt: localIso(2026, 7, 2), providerPostId: "urn:li:share:3" }),
    ]

    for (const post of posts) {
      const tabs = CONTENT_TABS.filter(({ value }) => belongsToTab(post, value))
      expect(tabs).toHaveLength(1)
    }
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

describe("isOverdue / hasFailed", () => {
  it("calls a queued post overdue once its moment has passed", () => {
    expect(isOverdue(makePost({ scheduledFor: localIso(2026, 7, 1) }), NOW)).toBe(true)
    expect(isOverdue(makePost({ scheduledFor: localIso(2026, 8, 3) }), NOW)).toBe(false)
  })

  it("never calls a published or dateless post overdue", () => {
    const published = makePost({
      scheduledFor: localIso(2026, 7, 1),
      publishedAt: localIso(2026, 7, 1),
      providerPostId: "urn",
    })

    expect(isOverdue(published, NOW)).toBe(false)
    expect(isOverdue(makePost({ scheduledFor: null }), NOW)).toBe(false)
  })

  it("separates a failed attempt from one that simply never ran", () => {
    expect(hasFailed(makePost({ scheduledFor: localIso(2026, 7, 1) }))).toBe(false)
    expect(
      hasFailed(makePost({ scheduledFor: localIso(2026, 7, 1), publishError: "token_expired" }))
    ).toBe(true)
  })

  it("does not call a published post failed, whatever an earlier attempt left behind", () => {
    const recovered = makePost({
      publishedAt: localIso(2026, 7, 2),
      providerPostId: "urn",
      publishError: "network",
    })

    expect(hasFailed(recovered)).toBe(false)
  })
})

describe("dayKeyForPost", () => {
  it("matches the key of the group the post actually lands in", () => {
    const post = makePost({ scheduledFor: localIso(2026, 8, 3) })
    const [month] = groupPostsByMonth([post], "queued")

    expect(dayKeyForPost(post, "queued")).toBe(month.days[0].key)
  })

  it("returns null for a post that isn't on the tab at all", () => {
    const draft = makePost({ scheduledFor: null })

    expect(dayKeyForPost(draft, "queued")).toBeNull()
    expect(dayKeyForPost(draft, "draft")).not.toBeNull()
  })

  it("changes key when a date moves the post to another day, and holds when it doesn't", () => {
    const post = makePost({ scheduledFor: localIso(2026, 8, 3, 9) })
    const key = dayKeyForPost(post, "queued")

    // Same calendar day, different time — still the same deck.
    expect(dayKeyForPost({ ...post, scheduledFor: localIso(2026, 8, 3, 21) }, "queued")).toBe(key)
    // Next day, and dropping the date entirely, both leave it.
    expect(dayKeyForPost({ ...post, scheduledFor: localIso(2026, 8, 4) }, "queued")).not.toBe(key)
    expect(dayKeyForPost({ ...post, scheduledFor: null }, "queued")).toBeNull()
  })
})

describe("groupPostsByMonth", () => {
  it("collapses a day's posts into one entry and orders queued months forwards", () => {
    const posts = [
      makePost({ scheduledFor: localIso(2026, 8, 3) }),
      makePost({ scheduledFor: localIso(2026, 7, 31) }),
      makePost({ scheduledFor: localIso(2026, 7, 31, 18) }),
    ]

    const months = groupPostsByMonth(posts, "queued")

    expect(months.map((month) => month.label)).toEqual(["July 2026", "August 2026"])
    expect(months[0].days).toHaveLength(1)
    expect(months[0].days[0].day).toBe(31)
    expect(months[0].days[0].posts).toHaveLength(2)
  })

  it("orders published months and days newest-first", () => {
    const posts = [
      makePost({ publishedAt: localIso(2026, 5, 4), providerPostId: "a" }),
      makePost({ publishedAt: localIso(2026, 7, 2), providerPostId: "b" }),
      makePost({ publishedAt: localIso(2026, 7, 20), providerPostId: "c" }),
    ]

    const months = groupPostsByMonth(posts, "published")

    expect(months.map((month) => month.label)).toEqual(["July 2026", "May 2026"])
    expect(months[0].days.map((day) => day.day)).toEqual([20, 2])
  })

  it("groups drafts by their created date, ignoring any scheduled date entirely", () => {
    const posts = [
      makePost({ scheduledFor: null, createdAt: localIso(2026, 7, 28) }),
      makePost({ scheduledFor: null, createdAt: localIso(2026, 7, 30) }),
    ]

    const months = groupPostsByMonth(posts, "draft")

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
    const queued = groupPostsByMonth([older, newer], "queued")
    expect(queued[0].days[0].posts).toEqual([newer, older])

    const drafts = [
      makePost({ scheduledFor: null, createdAt: localIso(2026, 7, 30, 9) }),
      makePost({ scheduledFor: null, createdAt: localIso(2026, 7, 30, 17) }),
    ]
    const draft = groupPostsByMonth(drafts, "draft")
    expect(draft[0].days[0].posts).toEqual([drafts[1], drafts[0]])
  })

  it("returns no months for a tab with nothing in it", () => {
    expect(groupPostsByMonth([makePost()], "queued")).toEqual([])
  })
})

describe("ordering within a day", () => {
  // The whole point of adding a time: two posts on the same day are no longer
  // interchangeable, and the tab's own direction decides which reads first.
  it("sorts Queued by scheduled time, earliest first", () => {
    const evening = makePost({ scheduledFor: localIso(2026, 8, 3, 18, 30) })
    const morning = makePost({ scheduledFor: localIso(2026, 8, 3, 9, 0) })
    const noon = makePost({ scheduledFor: localIso(2026, 8, 3, 12, 0) })

    const [month] = groupPostsByMonth([evening, morning, noon], "queued")
    expect(month.days[0].posts.map((p) => p.id)).toEqual([
      morning.id,
      noon.id,
      evening.id,
    ])
  })

  it("sorts Published by the time it went out, latest first", () => {
    const morning = makePost({
      publishedAt: localIso(2026, 7, 1, 9, 0),
      providerPostId: "morning",
    })
    const evening = makePost({
      publishedAt: localIso(2026, 7, 1, 18, 30),
      providerPostId: "evening",
    })

    const [month] = groupPostsByMonth([morning, evening], "published")
    expect(month.days[0].posts.map((p) => p.id)).toEqual([evening.id, morning.id])
  })

  // A generated batch shares one time, which is why creation order is kept as
  // the tiebreak rather than leaving those posts in an arbitrary order.
  it("falls back to newest-written first when the times match", () => {
    const older = makePost({
      scheduledFor: localIso(2026, 8, 3, 9, 0),
      createdAt: localIso(2026, 7, 20),
    })
    const newer = makePost({
      scheduledFor: localIso(2026, 8, 3, 9, 0),
      createdAt: localIso(2026, 7, 25),
    })

    const [month] = groupPostsByMonth([older, newer], "queued")
    expect(month.days[0].posts.map((p) => p.id)).toEqual([newer.id, older.id])
  })

  // Drafts have no scheduled time by definition, so they keep the old rule.
  it("keeps Draft on newest-written first", () => {
    const older = makePost({ scheduledFor: null, createdAt: localIso(2026, 7, 30, 9) })
    const newer = makePost({ scheduledFor: null, createdAt: localIso(2026, 7, 30, 17) })

    const [month] = groupPostsByMonth([older, newer], "draft")
    expect(month.days[0].posts.map((p) => p.id)).toEqual([newer.id, older.id])
  })
})
