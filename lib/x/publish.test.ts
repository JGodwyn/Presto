import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  checkXPublishGate,
  publishTweet,
  xTokenFailure,
  X_PUBLISH_SCOPE,
} from "./publish"

// The standing guard on AGENTS.md's hard publishing constraint for X, and the
// sibling of lib/linkedin/publish.test.ts. It exists to fail loudly if either
// half of the gate is ever weakened by accident — including by someone
// "fixing" a refusal that looks like a bug.

// What a connection made before tweet.write was requested carries, verbatim
// from the live exchange.
const READ_ONLY = "users.read tweet.read offline.access"
const FULL = `users.read tweet.read ${X_PUBLISH_SCOPE} offline.access`

afterEach(() => {
  delete process.env.PRESTO_ENABLE_LIVE_PUBLISH
  vi.unstubAllGlobals()
})

describe("the X publish gate", () => {
  it("is closed by default, with no env var set", () => {
    expect(checkXPublishGate({ scope: FULL })).toEqual({
      allowed: false,
      failure: "publishing_disabled",
    })
  })

  it("only opens for the exact string 'true'", () => {
    for (const value of ["1", "yes", "TRUE", "", "false"]) {
      process.env.PRESTO_ENABLE_LIVE_PUBLISH = value
      expect(checkXPublishGate({ scope: FULL })).toEqual({
        allowed: false,
        failure: "publishing_disabled",
      })
    }
  })

  // The switch is checked *first*, so a connection that has been granted
  // tweet.write still cannot publish while publishing is off. Asserting the
  // order matters: swapped, a scope-less connection would report the scope
  // problem and hide the fact that the switch is the real refusal.
  it("reports the switch before the scope when both would refuse", () => {
    expect(checkXPublishGate({ scope: READ_ONLY })).toEqual({
      allowed: false,
      failure: "publishing_disabled",
    })
  })

  it("still refuses with the switch on, when the grant predates tweet.write", () => {
    process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
    expect(checkXPublishGate({ scope: READ_ONLY })).toEqual({
      allowed: false,
      failure: "scope_not_granted",
    })
  })

  it("opens when both hold", () => {
    process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
    expect(checkXPublishGate({ scope: FULL })).toEqual({ allowed: true })
  })

  // **X's gate deliberately has no expiry key, unlike LinkedIn's.** Its access
  // token lives two hours and is renewed on almost every call, so `expires_at`
  // on the row is stale by design — gating on it would refuse virtually every
  // publish with "that connection has expired". Liveness is decided by what a
  // refresh actually returns (see xTokenFailure). This pins the absence, so
  // adding an expiry check "for symmetry" fails here rather than in production.
  it("does not care about a stored expiry", () => {
    process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
    // The shape the runner hands it carries an expiry the gate must ignore.
    const withStaleExpiry = { scope: FULL, expiresAt: new Date(0) }
    expect(checkXPublishGate(withStaleExpiry)).toEqual({ allowed: true })
  })
})

describe("publishTweet", () => {
  function respond(body: unknown, status = 201) {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(body === null ? "not json" : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchSpy)
    return fetchSpy
  }

  // The property that matters most: a refusal must not reach the network at
  // all. A gate that returned the right code *after* posting would pass every
  // test above and still have published.
  it("makes no request at all when the gate refuses", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const result = await publishTweet({
      account: { scope: FULL },
      accessToken: "token",
      content: "hello",
    })

    expect(result).toEqual({ ok: false, failure: "publishing_disabled" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("makes no request when only the switch is on", async () => {
    process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const result = await publishTweet({
      account: { scope: READ_ONLY },
      accessToken: "token",
      content: "hello",
    })

    expect(result).toEqual({ ok: false, failure: "scope_not_granted" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  describe("reading X's response", () => {
    beforeEach(() => {
      process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
    })

    it("sends the post as a JSON `text` field, bearing the token", async () => {
      const fetchSpy = respond({ data: { id: "1", text: "hello" } })

      await publishTweet({
        account: { scope: FULL },
        accessToken: "token",
        content: "hello",
      })

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toBe("https://api.x.com/2/tweets")
      expect(init.method).toBe("POST")
      expect(JSON.parse(String(init.body))).toEqual({ text: "hello" })
      expect(
        (init.headers as Record<string, string>).Authorization
      ).toBe("Bearer token")
    })

    it("returns the tweet id X put in the body", async () => {
      respond({ data: { id: "1966000000000000000", text: "hello" } })

      const result = await publishTweet({
        account: { scope: FULL },
        accessToken: "token",
        content: "hello",
      })

      expect(result).toEqual({ ok: true, postId: "1966000000000000000" })
    })

    // **The double-publish path**, arrived at down a different route from
    // LinkedIn's missing `x-restli-id`. A 2xx means the tweet was created; a
    // missing `data.id` means only that we cannot name it. Reporting a plain
    // `publish` failure here releases the claim and leaves the post retryable,
    // so the next attempt puts a second copy on the real timeline.
    it("does not call a 2xx without an id a failure to publish", async () => {
      respond({ data: {} })

      const result = await publishTweet({
        account: { scope: FULL },
        accessToken: "token",
        content: "hello",
      })

      expect(result).toEqual({ ok: false, failure: "published_without_urn" })
    })

    // Same reasoning one step further out: the tweet exists whether or not the
    // body parses, so "I can't read this" must never be reported as "it didn't
    // go out".
    it("treats an unreadable 2xx body the same way", async () => {
      respond(null)

      const result = await publishTweet({
        account: { scope: FULL },
        accessToken: "token",
        content: "hello",
      })

      expect(result).toEqual({ ok: false, failure: "published_without_urn" })
    })

    // 403 is what an over-length post, a duplicate, or a permission the app no
    // longer holds all come back as. Nothing was created, so this really is a
    // failure and the claim really should be released.
    it("still calls a non-2xx a publish failure, since nothing was created", async () => {
      respond({ detail: "Your Tweet text is too long." }, 403)

      const result = await publishTweet({
        account: { scope: FULL },
        accessToken: "token",
        content: "x".repeat(281),
      })

      expect(result).toEqual({ ok: false, failure: "publish" })
    })

    // **Found live**: the first real send came back
    // `402 {"detail":"credits depleted","title":"Payment Required"}`, and was
    // reported as "X wouldn't accept this post. Try again." Nothing about the
    // post was wrong and no number of retries could have worked — the app's API
    // account was simply out of credits. These two statuses are about the
    // *account*, not the post, and must not read as a rejected post.
    it("reports an exhausted quota as its own permanent failure", async () => {
      respond(
        {
          detail: "credits depleted",
          status: 402,
          title: "Payment Required",
          type: "https://api.x.com/2/problems/credits-depleted",
        },
        402
      )

      const result = await publishTweet({
        account: { scope: FULL },
        accessToken: "token",
        content: "hello",
      })

      expect(result).toEqual({ ok: false, failure: "quota_exhausted" })
    })

    it("reports a rate limit as its own retryable failure", async () => {
      respond({ title: "Too Many Requests" }, 429)

      const result = await publishTweet({
        account: { scope: FULL },
        accessToken: "token",
        content: "hello",
      })

      expect(result).toEqual({ ok: false, failure: "rate_limited" })
    })

    // Neither may collapse into the other, and neither into `publish`: one says
    // stop, one says wait, one says fix the post.
    it("keeps the three refusals distinct", async () => {
      const seen: string[] = []
      for (const status of [402, 429, 403]) {
        respond({ title: "nope" }, status)
        const result = await publishTweet({
          account: { scope: FULL },
          accessToken: "token",
          content: "hello",
        })
        seen.push(result.ok ? "ok" : result.failure)
      }
      expect(seen).toEqual(["quota_exhausted", "rate_limited", "publish"])
    })

    it("reports a dropped connection as a network failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new TypeError("fetch failed"))
      )

      const result = await publishTweet({
        account: { scope: FULL },
        accessToken: "token",
        content: "hello",
      })

      expect(result).toEqual({ ok: false, failure: "network" })
    })
  })
})

// A dead connection and a bad moment must not read the same: one asks the user
// to reconnect, the other asks them to try again. Getting this backwards either
// tells someone to re-authorise over a rate limit, or leaves a genuinely dead
// connection looking retryable forever.
describe("xTokenFailure", () => {
  it("maps a dead grant to an expiry, which is the reconnect message", () => {
    expect(xTokenFailure("revoked")).toBe("token_expired")
  })

  it("maps a missing connection to itself", () => {
    expect(xTokenFailure("not_connected")).toBe("not_connected")
  })

  it("never reports an unreachable provider as a rejected post", () => {
    // `publish` means "X looked at this and said no", which is a thing a user
    // would act on by editing the post. Neither of these is that.
    expect(xTokenFailure("unavailable")).toBe("token_unavailable")
    expect(xTokenFailure("config")).toBe("token_unavailable")
  })
})
