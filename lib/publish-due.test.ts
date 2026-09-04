import { describe, expect, it } from "vitest"

import {
  dueWindow,
  isDueNow,
  PUBLISH_GRACE_MINUTES,
  PUBLISH_TICK_MINUTES,
  skipReason,
} from "@/lib/publish-due"

const NOW = new Date("2026-09-02T12:00:00Z")

function minutesFromNow(minutes: number): string {
  return new Date(NOW.getTime() + minutes * 60_000).toISOString()
}

describe("isDueNow", () => {
  it("sends a post whose moment has just passed", () => {
    expect(isDueNow(minutesFromNow(-1), NOW)).toBe(true)
  })

  it("does not send a post whose moment hasn't come", () => {
    expect(isDueNow(minutesFromNow(1), NOW)).toBe(false)
    expect(isDueNow(minutesFromNow(60 * 24), NOW)).toBe(false)
  })

  // The rule the user asked for, and the reason the whole module exists: 60
  // posts were already past their date when this was written, the oldest by two
  // months. None of them may ever be sent by a tick.
  it("never sends the backlog, however far past it is", () => {
    expect(isDueNow(minutesFromNow(-60), NOW)).toBe(false)
    expect(isDueNow(minutesFromNow(-60 * 24), NOW)).toBe(false)
    expect(isDueNow("2026-06-30T23:00:00Z", NOW)).toBe(false)
  })

  // The grace window is a fixed 15 minutes, independent of how often the job
  // runs — long enough to ride out a deploy, short enough that whatever it
  // sends is still recognisably the post that was scheduled.
  it("rides out a short outage and then gives up", () => {
    expect(isDueNow(minutesFromNow(-(PUBLISH_GRACE_MINUTES - 1)), NOW)).toBe(true)
    expect(isDueNow(minutesFromNow(-PUBLISH_GRACE_MINUTES), NOW)).toBe(true)
    expect(isDueNow(minutesFromNow(-(PUBLISH_GRACE_MINUTES + 1)), NOW)).toBe(false)
  })

  it("ignores a post with no date at all — a draft is not scheduled", () => {
    expect(isDueNow(null, NOW)).toBe(false)
  })

  it("treats an unparseable date as not due rather than as now", () => {
    expect(isDueNow("not a date", NOW)).toBe(false)
  })
})

describe("the two constants", () => {
  // They used to be one: grace was `tick * 3`, so changing the cadence silently
  // changed the safety margin. Pinned apart so that can't happen again.
  it("keeps grace independent of the tick", () => {
    expect(PUBLISH_GRACE_MINUTES).toBe(15)
    expect(PUBLISH_GRACE_MINUTES % PUBLISH_TICK_MINUTES === 0).toBe(true)
    expect(PUBLISH_GRACE_MINUTES).toBeGreaterThan(PUBLISH_TICK_MINUTES)
  })
})

describe("dueWindow", () => {
  it("spans the grace period back from now", () => {
    const window = dueWindow(NOW)
    expect(window.to).toBe(NOW.toISOString())
    expect(Date.parse(window.to) - Date.parse(window.from)).toBe(
      PUBLISH_GRACE_MINUTES * 60_000
    )
  })
})

describe("skipReason", () => {
  it("separates the future from the backlog", () => {
    expect(skipReason(minutesFromNow(30), NOW)).toBe("not_yet")
    expect(skipReason(minutesFromNow(-60 * 24), NOW)).toBe("too_old")
  })

  it("has nothing to say about a post it would send", () => {
    expect(skipReason(minutesFromNow(-1), NOW)).toBeNull()
  })
})
