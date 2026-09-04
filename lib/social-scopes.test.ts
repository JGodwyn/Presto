import { describe, expect, it } from "vitest"

import { LINKEDIN_SCOPES } from "@/lib/linkedin/scopes"
import { isGrantStale } from "@/lib/social-scopes"
import { X_SCOPES } from "@/lib/x/scopes"

// The bug this file exists to prevent: `grantIsCurrent` asks a LinkedIn
// question, and asking it of an X row compares X's scopes against a list
// containing w_member_social. Every connected X account then wore a permanent
// "Reconnect" chip, for a permission X is never asked for and that reconnecting
// could not clear — X went live on main while that branch was open, so the two
// only met at the merge.
//
// The answer is now per-platform rather than "LinkedIn or nothing", so the test
// has to hold both halves: X's own grant list is a real question with a real
// answer, and neither platform's list may leak into the other's.
describe("isGrantStale", () => {
  const CURRENT_LINKEDIN = LINKEDIN_SCOPES.join(",")
  const CURRENT_X = X_SCOPES.join(" ")
  // Verbatim from the live exchange: what LinkedIn granted before
  // w_member_social was requested.
  const SIGN_IN_ONLY_LINKEDIN = "email,openid,profile"
  // The grant left behind by the few hours X publishing was switched on. It
  // holds *more* than the app now asks for, which must not read as stale.
  const OVER_GRANTED_X = `${CURRENT_X} tweet.write`

  it("passes a current grant on either platform", () => {
    expect(isGrantStale("linkedin", CURRENT_LINKEDIN)).toBe(false)
    expect(isGrantStale("x", CURRENT_X)).toBe(false)
  })

  it("catches a grant made before its own platform's publish scope", () => {
    expect(isGrantStale("linkedin", SIGN_IN_ONLY_LINKEDIN)).toBe(true)
  })

  // X asks for nothing beyond sign-in and reading, so no X connection this app
  // can make is stale today. That will change the day X publishing ships, and
  // the branch is already here and tested — this pins the current answer rather
  // than the mechanism, so turning it on fails here and says so.
  it("has no stale X grant while X asks only for read scopes", () => {
    expect(isGrantStale("x", CURRENT_X)).toBe(false)
    expect(isGrantStale("x", OVER_GRANTED_X)).toBe(false)
  })

  // The original bug, stated as the invariant rather than the symptom: each
  // platform is judged against its own list and nothing else. A grant that is
  // current for one platform must never be judged by the other's.
  it("never judges one platform's grant against the other's list", () => {
    expect(isGrantStale("x", CURRENT_LINKEDIN)).toBe(true)
    expect(isGrantStale("linkedin", CURRENT_X)).toBe(true)
  })

  it("says nothing about a platform it has no list for", () => {
    expect(isGrantStale("mastodon", "")).toBe(false)
    expect(isGrantStale("", CURRENT_X)).toBe(false)
  })
})
