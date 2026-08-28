import { describe, expect, it } from "vitest"

import {
  EXPIRY_WARNING_DAYS,
  expiryStatus,
  formatDate,
  formatDateRange,
  formatExpiry,
  formatOrdinal,
} from "@/lib/format-date"

const NOW = new Date("2026-08-21T12:00:00Z")
const HOUR = 3_600_000
const DAY = 86_400_000

function inDays(days: number) {
  return new Date(NOW.getTime() + days * DAY)
}

describe("expiryStatus", () => {
  it("is active well clear of the warning window", () => {
    expect(expiryStatus(inDays(60), NOW)).toBe("active")
    expect(expiryStatus(inDays(8), NOW)).toBe("active")
  })

  it("warns from exactly EXPIRY_WARNING_DAYS out", () => {
    expect(expiryStatus(inDays(EXPIRY_WARNING_DAYS), NOW)).toBe("expiring")
    expect(expiryStatus(inDays(1), NOW)).toBe("expiring")
  })

  it("is expired at and past the deadline", () => {
    expect(expiryStatus(NOW, NOW)).toBe("expired")
    expect(expiryStatus(inDays(-1), NOW)).toBe("expired")
  })

  // The last hours are the point of the floor in formatExpiry: a token with 30
  // minutes left is still alive, so it must warn rather than read as expired.
  it("still warns in the final hours", () => {
    expect(expiryStatus(new Date(NOW.getTime() + HOUR / 2), NOW)).toBe(
      "expiring"
    )
  })

  // The status shares formatExpiry's rounding on purpose, so the colour and
  // the label can never disagree — a row reading "Expires in 7 days" is always
  // the amber one, and one reading "8 days" never is.
  it("agrees with the label it sits next to, across the boundary", () => {
    const justInside = new Date(NOW.getTime() + 7.4 * DAY)
    expect(formatExpiry(justInside, NOW)).toBe("Expires in 7 days")
    expect(expiryStatus(justInside, NOW)).toBe("expiring")

    const justOutside = new Date(NOW.getTime() + 7.6 * DAY)
    expect(formatExpiry(justOutside, NOW)).toBe("Expires in 8 days")
    expect(expiryStatus(justOutside, NOW)).toBe("active")
  })

  it("never labels a live token as expired", () => {
    const almostGone = new Date(NOW.getTime() + 1000)
    expect(formatExpiry(almostGone, NOW)).toBe("Expires in 1 day")
    expect(expiryStatus(almostGone, NOW)).toBe("expiring")
  })
})

describe("formatDate", () => {
  // The whole point: a date with no year *means* this year, so printing it is
  // noise — and dropping it is what lets a date share a card header with a
  // time.
  it("drops the year when it is the current one", () => {
    expect(formatDate(new Date(2026, 7, 29), NOW)).toBe("Aug 29")
  })

  it("keeps the year for any other", () => {
    expect(formatDate(new Date(2027, 7, 28), NOW)).toBe("Aug 28, 2027")
    expect(formatDate(new Date(2025, 0, 1), NOW)).toBe("Jan 1, 2025")
  })

  // It carries no ordinal; formatOrdinal survives only for the bare day
  // numbers on the Content page's Calendar view.
  it("carries no ordinal, unlike a bare day number", () => {
    expect(formatDate(new Date(2026, 7, 1), NOW)).toBe("Aug 1")
    expect(formatOrdinal(1)).toBe("1st")
    expect(formatOrdinal(3)).toBe("3rd")
  })

  it("spells September as Sept", () => {
    expect(formatDate(new Date(2026, 8, 15), NOW)).toBe("Sept 15")
  })
})

describe("formatDateRange", () => {
  it("drops the year when both ends are in the current one", () => {
    expect(
      formatDateRange(new Date(2026, 11, 24), new Date(2026, 11, 31), NOW)
    ).toBe("Dec 24 – Dec 31")
  })

  it("says a shared non-current year once, at the end", () => {
    expect(
      formatDateRange(new Date(2027, 11, 24), new Date(2027, 11, 31), NOW)
    ).toBe("Dec 24 – Dec 31, 2027")
  })

  // The case that makes the rule necessary: without both years this reads as
  // ending three weeks before it starts.
  it("carries both years when the range crosses a year boundary", () => {
    expect(
      formatDateRange(new Date(2026, 11, 24), new Date(2027, 0, 15), NOW)
    ).toBe("Dec 24, 2026 – Jan 15, 2027")
  })

  // ...including when one of the two years is the current one, which is
  // exactly when a "drop the current year" rule alone would get it wrong.
  it("keeps the current year too when the other end is elsewhere", () => {
    expect(
      formatDateRange(new Date(2026, 11, 24), new Date(2027, 0, 15), NOW)
    ).toContain("2026")
  })

  it("falls back to a single date while only the start is picked", () => {
    expect(formatDateRange(new Date(2026, 7, 28), undefined, NOW)).toBe("Aug 28")
  })
})
