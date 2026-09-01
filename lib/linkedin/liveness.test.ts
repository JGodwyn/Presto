import { describe, expect, it } from "vitest"

import {
  isLivenessCheckDue,
  LIVENESS_CHECK_INTERVAL_MS,
} from "./liveness"

const NOW = new Date("2026-08-31T12:00:00Z")

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString()
}

describe("isLivenessCheckDue", () => {
  it("is due when the connection has never been checked", () => {
    expect(
      isLivenessCheckDue({ status: "active", lastCheckedAt: null }, NOW)
    ).toBe(true)
  })

  it("is not due inside the interval", () => {
    const account = {
      status: "active" as const,
      lastCheckedAt: ago(LIVENESS_CHECK_INTERVAL_MS - 1000),
    }
    expect(isLivenessCheckDue(account, NOW)).toBe(false)
  })

  it("is due once the interval has passed", () => {
    const account = {
      status: "active" as const,
      lastCheckedAt: ago(LIVENESS_CHECK_INTERVAL_MS),
    }
    expect(isLivenessCheckDue(account, NOW)).toBe(true)
  })

  // Only reconnecting clears a revocation, and the OAuth callback resets the
  // column when it does — so re-asking LinkedIn about a dead row is pure waste.
  it("is never due for a connection already known revoked", () => {
    expect(
      isLivenessCheckDue({ status: "revoked", lastCheckedAt: null }, NOW)
    ).toBe(false)
    expect(
      isLivenessCheckDue(
        { status: "revoked", lastCheckedAt: ago(LIVENESS_CHECK_INTERVAL_MS * 10) },
        NOW
      )
    ).toBe(false)
  })

  it("treats an unparseable timestamp as never checked", () => {
    expect(
      isLivenessCheckDue({ status: "active", lastCheckedAt: "not a date" }, NOW)
    ).toBe(true)
  })
})
