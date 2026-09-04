import { afterEach, describe, expect, it, vi } from "vitest"

import {
  checkPublishGate,
  hasPublishScope,
  isLivePublishEnabled,
  LINKEDIN_PUBLISH_SCOPE,
  personUrn,
  publishTextPost,
  type PublishableAccount,
} from "./publish"

// These tests are the standing guard on AGENTS.md's hard publishing
// constraint. They exist to fail loudly if either half of the gate is ever
// weakened by accident — including by someone "fixing" a refusal that looks
// like a bug.

const FUTURE = new Date("2026-10-01T00:00:00Z")
const NOW = new Date("2026-08-31T00:00:00Z")

function account(overrides: Partial<PublishableAccount> = {}): PublishableAccount {
  return {
    providerAccountId: "abc123",
    // What a real connection carries today: sign-in scopes, comma-delimited,
    // exactly as LinkedIn returned them on the live exchange.
    scope: "email,openid,profile",
    expiresAt: FUTURE,
    ...overrides,
  }
}

afterEach(() => {
  delete process.env.PRESTO_ENABLE_LIVE_PUBLISH
  vi.unstubAllGlobals()
})

describe("hasPublishScope", () => {
  it("finds the publish scope in either delimiter", () => {
    expect(hasPublishScope(`email,${LINKEDIN_PUBLISH_SCOPE}`)).toBe(true)
    expect(hasPublishScope(`email ${LINKEDIN_PUBLISH_SCOPE}`)).toBe(true)
  })

  // A connection made before 2026-09-02 carries exactly these three, which is
  // why the gate still refuses one until the member reconnects.
  it("does not find it in a grant that predates the scope being requested", () => {
    expect(hasPublishScope("email,openid,profile")).toBe(false)
  })
})

describe("the publish gate", () => {
  it("is closed by default, with no env var set", () => {
    expect(isLivePublishEnabled()).toBe(false)
    expect(checkPublishGate(account(), NOW)).toEqual({
      allowed: false,
      failure: "publishing_disabled",
    })
  })

  it("only opens for the exact string 'true'", () => {
    for (const value of ["1", "yes", "TRUE", "", "false"]) {
      process.env.PRESTO_ENABLE_LIVE_PUBLISH = value
      expect(isLivePublishEnabled()).toBe(false)
    }
  })

  // The second key, and the one that cannot be turned by editing config: no
  // stored token carries the scope, because it is never requested.
  it("still refuses with the switch on, because the scope is not granted", () => {
    process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
    expect(checkPublishGate(account(), NOW)).toEqual({
      allowed: false,
      failure: "scope_not_granted",
    })
  })

  it("refuses an expired token even with both the switch and the scope", () => {
    process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
    const expired = account({
      scope: `openid,profile,${LINKEDIN_PUBLISH_SCOPE}`,
      expiresAt: new Date(NOW.getTime() - 1),
    })
    expect(checkPublishGate(expired, NOW)).toEqual({
      allowed: false,
      failure: "token_expired",
    })
  })

  it("opens only when all three hold", () => {
    process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
    const ready = account({ scope: `openid,profile,${LINKEDIN_PUBLISH_SCOPE}` })
    expect(checkPublishGate(ready, NOW)).toEqual({ allowed: true })
  })
})

describe("publishTextPost", () => {
  // The property that matters most: a refusal must not reach the network at
  // all. A gate that returned the right code *after* posting would pass every
  // test above and still have published.
  it("makes no request at all when the gate refuses", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const result = await publishTextPost({
      account: account(),
      accessToken: "token",
      content: "hello",
      now: NOW,
    })

    expect(result).toEqual({ ok: false, failure: "publishing_disabled" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("makes no request when only the switch is on", async () => {
    process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const result = await publishTextPost({
      account: account(),
      accessToken: "token",
      content: "hello",
      now: NOW,
    })

    expect(result).toEqual({ ok: false, failure: "scope_not_granted" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // Everything below actually reaches postShare's response handling, which is
  // where the bug lived. A test that mocks publishTextPost itself cannot see
  // any of this.
  describe("reading LinkedIn's response", () => {
    function allowed() {
      process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
      return account({ scope: "openid profile email w_member_social" })
    }

    function respond(init: { status: number; urn?: string }) {
      const headers = new Headers()
      if (init.urn) headers.set("x-restli-id", init.urn)
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(null, { status: init.status, headers })
        )
      )
    }

    it("returns the URN LinkedIn put in the header", async () => {
      respond({ status: 201, urn: "urn:li:share:99" })

      const result = await publishTextPost({
        account: allowed(),
        accessToken: "token",
        content: "hello",
        now: NOW,
      })

      expect(result).toEqual({ ok: true, postUrn: "urn:li:share:99" })
    })

    // **The double-publish path.** A 2xx means the post was created; a missing
    // x-restli-id means only that we cannot name it. Reporting a plain
    // `publish` failure here — which this did — releases the claim and leaves
    // the post retryable, so the next attempt puts a second copy on the
    // member's real timeline.
    it("does not call a 2xx without a URN a failure to publish", async () => {
      respond({ status: 201 })

      const result = await publishTextPost({
        account: allowed(),
        accessToken: "token",
        content: "hello",
        now: NOW,
      })

      expect(result).toEqual({ ok: false, failure: "published_without_urn" })
    })

    it("still calls a non-2xx a publish failure, since nothing was created", async () => {
      respond({ status: 422 })

      const result = await publishTextPost({
        account: allowed(),
        accessToken: "token",
        content: "hello",
        now: NOW,
      })

      expect(result).toEqual({ ok: false, failure: "publish" })
    })
  })
})

describe("personUrn", () => {
  it("builds the author URN from the stored OIDC sub", () => {
    expect(personUrn("abc123")).toBe("urn:li:person:abc123")
  })
})
