import { describe, expect, it } from "vitest"

import {
  EXPIRY_WARNING_DAYS,
  expiryStatus,
  formatExpiry,
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
