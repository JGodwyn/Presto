import { describe, expect, it } from "vitest"

import {
  countUnscheduled,
  createdInMonth,
  totalsByState,
  createdWithinDays,
  formatRelativeDay,
  nextUp,
  platformSplit,
  summariseMonth,
  topTopics,
} from "@/lib/dashboard-summary"
import type { Post } from "@/types/post"

// Mid-August 2026, local time — the same shape lib/content-grouping.test.ts
// uses, and local on purpose: every date read in dashboard-summary is local.
const NOW = new Date(2026, 7, 12, 9, 0).getTime()

function post(overrides: Partial<Post>): Post {
  return {
    id: crypto.randomUUID(),
    projectId: "project",
    platform: "linkedin",
    status: "scheduled",
    content: "Some post",
    topics: [],
    scheduledFor: null,
    createdAt: new Date(NOW).toISOString(),
    isTryout: false,
    publishedAt: null,
    providerPostId: null,
    publishError: null,
    ...overrides,
  }
}

function onDay(day: number, overrides: Partial<Post> = {}): Post {
  return post({ scheduledFor: new Date(2026, 7, day, 9, 0).toISOString(), ...overrides })
}

describe("summariseMonth", () => {
  it("counts only the reference month, split around now", () => {
    const summary = summariseMonth(
      [
        onDay(3),
        onDay(11),
        onDay(20),
        onDay(20),
        post({ scheduledFor: new Date(2026, 8, 4, 9, 0).toISOString() }),
        post({ scheduledFor: null }),
      ],
      NOW
    )

    expect(summary.daysInMonth).toBe(31)
    expect(summary.today).toBe(12)
    expect(summary.scheduled).toBe(4)
    expect(summary.past).toBe(2)
    expect(summary.upcoming).toBe(2)
    expect(summary.countsByDay[19]).toBe(2)
  })

  it("measures remaining coverage from today, not from the whole month", () => {
    // Two covered days behind today, one ahead.
    const summary = summariseMonth([onDay(3), onDay(4), onDay(25)], NOW)

    expect(summary.daysCovered).toBe(3)
    // 12th through 31st inclusive — today still counts as a day you can post on.
    expect(summary.daysRemaining).toBe(20)
    expect(summary.remainingDaysCovered).toBe(1)
  })

  it("splits a single day's posts into still-to-come and gone", () => {
    // The 12th is today: 9am has passed, 6pm has not. The dashboard calendar
    // uses this to send that day to the right Content tab — by date alone it
    // would always read as Queued.
    const posts = [
      post({ scheduledFor: new Date(2026, 7, 12, 6, 0).toISOString() }),
      post({ scheduledFor: new Date(2026, 7, 12, 18, 0).toISOString() }),
      onDay(20),
    ]
    const summary = summariseMonth(posts, NOW)

    expect(summary.countsByDay[11]).toBe(2)
    expect(summary.upcomingByDay[11]).toBe(1)
    // A day entirely in the past has posts but nothing upcoming.
    expect(summary.countsByDay[19]).toBe(1)
    expect(summary.upcomingByDay[19]).toBe(1)
  })

  it("treats a post scheduled for later today as still to come", () => {
    const summary = summariseMonth([onDay(12)], NOW)

    expect(summary.upcoming).toBe(1)
    expect(summary.past).toBe(0)
    expect(summary.remainingDaysCovered).toBe(1)
  })

  it("has no today, and no remaining-day bias, in another month", () => {
    const summary = summariseMonth([], NOW, new Date(2026, 8, 1))

    expect(summary.today).toBeNull()
    expect(summary.daysInMonth).toBe(30)
    expect(summary.daysRemaining).toBe(30)
  })
})

describe("countUnscheduled", () => {
  it("counts dateless posts whenever they were written", () => {
    const old = post({
      scheduledFor: null,
      createdAt: new Date(2025, 0, 1).toISOString(),
    })
    expect(countUnscheduled([old, post({}), onDay(20)])).toBe(2)
  })
})

describe("nextUp", () => {
  it("returns soonest-first and stops at the limit", () => {
    const result = nextUp([onDay(30), onDay(14), onDay(20), onDay(2)], NOW, 2)

    expect(result.map((entry) => new Date(entry.scheduledFor!).getDate())).toEqual([
      14, 20,
    ])
  })
})

describe("topTopics", () => {
  it("orders by count, breaking ties alphabetically", () => {
    const result = topTopics(
      [
        post({ topics: ["design", "career"] }),
        post({ topics: ["design"] }),
        post({ topics: ["career"] }),
        post({ topics: ["ai"] }),
      ],
      3
    )

    expect(result).toEqual([
      { topic: "career", count: 2 },
      { topic: "design", count: 2 },
      { topic: "ai", count: 1 },
    ])
  })
})

describe("platformSplit", () => {
  it("reports every row even when one is unused", () => {
    expect(platformSplit([post({ platform: "linkedin" })])).toEqual({
      linkedin: 1,
      x: 0,
      tryout: 0,
    })
  })

  it("counts a try-out post as its own row, not under its platform", () => {
    // The whole point of the partition: a try-out post carries
    // platform: "linkedin", so counting by platform alone would report it as
    // a LinkedIn post and leave the Try out bar reading zero.
    expect(
      platformSplit([
        post({ platform: "linkedin", isTryout: true }),
        post({ platform: "linkedin" }),
      ])
    ).toEqual({ linkedin: 1, x: 0, tryout: 1 })
  })

  it("keeps the three counts disjoint, summing to the post count", () => {
    const posts = [
      post({ platform: "linkedin" }),
      post({ platform: "x" }),
      post({ platform: "linkedin", isTryout: true }),
      post({ platform: "x", isTryout: true }),
    ]
    const split = platformSplit(posts)
    expect(split.linkedin + split.x + split.tryout).toBe(posts.length)
    expect(split).toEqual({ linkedin: 1, x: 1, tryout: 2 })
  })
})

describe("createdWithinDays", () => {
  it("counts by creation, ignoring whether the post is scheduled", () => {
    const posts = [
      post({ createdAt: new Date(NOW - 2 * 86_400_000).toISOString() }),
      post({ createdAt: new Date(NOW - 30 * 86_400_000).toISOString() }),
      onDay(30, { createdAt: new Date(NOW - 1 * 86_400_000).toISOString() }),
    ]

    expect(createdWithinDays(posts, NOW, 7)).toBe(2)
  })
})

describe("formatRelativeDay", () => {
  const now = new Date(NOW)

  it("compares calendar days, not elapsed hours", () => {
    // 11pm tonight is 14 hours out but still "Today"; 1am tomorrow is 16
    // hours out and is "Tomorrow".
    expect(formatRelativeDay(new Date(2026, 7, 12, 23, 0), now)).toBe("Today")
    expect(formatRelativeDay(new Date(2026, 7, 13, 1, 0), now)).toBe("Tomorrow")
  })

  it("reads forwards and backwards", () => {
    expect(formatRelativeDay(new Date(2026, 7, 17, 9, 0), now)).toBe("in 5 days")
    expect(formatRelativeDay(new Date(2026, 7, 11, 9, 0), now)).toBe("1 day ago")
    expect(formatRelativeDay(new Date(2026, 7, 9, 9, 0), now)).toBe("3 days ago")
  })
})

describe("totalsByState", () => {
  it("counts Published from publishedAt, never from a passed date or the status column", () => {
    // `status` is deliberately wrong on each of these: it is vestigial, and
    // the split must not read it. Two of these have a date in the past and
    // neither is published — under the old date-derived rule both were.
    const posts = [
      post({ scheduledFor: null, status: "published" }),
      onDay(30, { status: "draft" }),
      onDay(2, { status: "draft" }),
      onDay(3, { status: "scheduled" }),
    ]

    expect(totalsByState(posts)).toEqual({
      total: 4,
      draft: 1,
      queued: 3,
      published: 0,
    })
  })

  it("counts a post as published once it has actually gone out", () => {
    const posts = [
      onDay(2, { publishedAt: new Date(2026, 7, 2).toISOString(), providerPostId: "urn" }),
      onDay(30),
    ]

    expect(totalsByState(posts)).toMatchObject({ total: 2, published: 1, queued: 1 })
  })

  it("reports zeroes for an empty library rather than dividing by nothing", () => {
    expect(totalsByState([])).toEqual({
      total: 0,
      draft: 0,
      queued: 0,
      published: 0,
    })
  })
})

describe("createdInMonth", () => {
  it("counts by creation date, ignoring what the post is scheduled for", () => {
    const posts = [
      post({ createdAt: new Date(2026, 7, 1).toISOString() }),
      // Scheduled into August but written in July — not this month's writing.
      onDay(20, { createdAt: new Date(2026, 6, 30).toISOString() }),
      post({ createdAt: new Date(2026, 7, 31, 23, 0).toISOString() }),
    ]

    expect(createdInMonth(posts, new Date(NOW))).toBe(2)
  })
})
