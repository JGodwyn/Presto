import { describe, expect, it } from "vitest"

import {
  healthyConnectedPlatforms,
  hasDeadLinkedInConnection,
  isBlockedByExpiredLinkedIn,
} from "@/lib/connection-health"
import type { ConnectedSocialAccount } from "@/types/social-account"

const NOW = new Date("2026-09-08T12:00:00.000Z")

function account(
  overrides: Partial<ConnectedSocialAccount> = {}
): ConnectedSocialAccount {
  return {
    id: "account-1",
    platform: "linkedin",
    accountName: "Godwin John",
    accountHandle: null,
    accountEmail: null,
    avatarUrl: null,
    connectedAt: "2026-08-01T12:00:00.000Z",
    expiresAt: "2026-10-01T12:00:00.000Z",
    scope: "openid,profile,w_member_social",
    status: "active",
    lastCheckedAt: null,
    ...overrides,
  }
}

describe("hasDeadLinkedInConnection", () => {
  it("finds expired and revoked LinkedIn connections", () => {
    expect(
      hasDeadLinkedInConnection(
        [account({ expiresAt: "2026-09-07T12:00:00.000Z" })],
        NOW
      )
    ).toBe(true)
    expect(
      hasDeadLinkedInConnection([account({ status: "revoked" })], NOW)
    ).toBe(true)
  })

  it("ignores healthy LinkedIn and dead X connections", () => {
    expect(hasDeadLinkedInConnection([account()], NOW)).toBe(false)
    expect(
      hasDeadLinkedInConnection(
        [
          account({
            platform: "x",
            expiresAt: "2026-09-07T12:00:00.000Z",
          }),
        ],
        NOW
      )
    ).toBe(false)
  })
})

describe("healthyConnectedPlatforms", () => {
  it("excludes expired and revoked accounts from Generate", () => {
    expect(
      healthyConnectedPlatforms(
        [
          account(),
          account({
            id: "expired-x",
            platform: "x",
            expiresAt: "2026-09-07T12:00:00.000Z",
          }),
          account({ id: "revoked-linkedin", status: "revoked" }),
        ],
        NOW
      )
    ).toEqual(["linkedin"])
  })
})

describe("isBlockedByExpiredLinkedIn", () => {
  it("blocks only real LinkedIn posting", () => {
    expect(isBlockedByExpiredLinkedIn(true, "linkedin", false)).toBe(true)
    expect(isBlockedByExpiredLinkedIn(true, "linkedin", true)).toBe(false)
    expect(isBlockedByExpiredLinkedIn(true, "x", false)).toBe(false)
    expect(isBlockedByExpiredLinkedIn(false, "linkedin", false)).toBe(false)
  })
})
