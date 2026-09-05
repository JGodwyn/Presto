import { describe, expect, it } from "vitest"

import {
  hasXPublishScope,
  X_PUBLISH_SCOPE,
  X_SCOPES,
  xGrantIsCurrent,
} from "@/lib/x/scopes"

// The tripwire, restored. It lived in oauth.test.ts and pinned AGENTS.md's hard
// publishing constraint for as long as X publishing was unbuilt; it fired,
// loudly, the day `tweet.write` was added under an explicit green-light — which
// is exactly what it was for.
//
// That green-light did not survive contact with X's billing: the first real
// send came back `402 credits depleted`, posting is metered per *app* across
// every user of Presto, and the owner's decision was not to pay. So the scope
// came back out, and so did this. A member must not be asked to grant posting
// permission the app will not use.
describe("X_SCOPES", () => {
  it("never requests a write scope", () => {
    for (const scope of X_SCOPES) {
      expect(scope).not.toContain("write")
    }
    expect(X_SCOPES).not.toContain(X_PUBLISH_SCOPE)
  })

  it("is exactly the set this app intends to hold", () => {
    // Written out rather than derived, so widening the list is a deliberate
    // edit here as well as there — including the day X publishing is turned on.
    expect([...X_SCOPES].sort()).toEqual([
      "offline.access",
      "tweet.read",
      "users.read",
    ])
  })

  it("requests offline.access, without which the connection dies in 2 hours", () => {
    expect(X_SCOPES).toContain("offline.access")
  })

  // Nothing here asks to post, read someone's timeline, follow, DM or delete.
  // Those are separate X scopes and none is requested; a list that grew one
  // would fail the exact-set assertion above, and this says why that matters.
  it("asks for nothing beyond signing in and reading", () => {
    for (const scope of [
      X_PUBLISH_SCOPE,
      "tweet.moderate.write",
      "follows.write",
      "dm.write",
    ]) {
      expect(X_SCOPES).not.toContain(scope)
    }
  })
})

describe("xGrantIsCurrent", () => {
  it("accepts a full grant whatever its order", () => {
    expect(xGrantIsCurrent(X_SCOPES.join(" "))).toBe(true)
    expect(xGrantIsCurrent([...X_SCOPES].reverse().join(" "))).toBe(true)
  })

  // The connection made during the few hours tweet.write *was* requested holds
  // more than the app now asks for. It must not read as stale: there is nothing
  // to reconnect for, and a permanent "Reconnect" chip nobody can clear is the
  // exact bug lib/social-scopes.ts exists to prevent.
  it("accepts a grant carrying more than is asked for", () => {
    expect(xGrantIsCurrent(`${X_SCOPES.join(" ")} tweet.write`)).toBe(true)
    expect(xGrantIsCurrent(`${X_SCOPES.join(" ")} like.read`)).toBe(true)
  })

  it("rejects a grant missing any requested scope", () => {
    for (const scope of X_SCOPES) {
      const partial = X_SCOPES.filter((other) => other !== scope)
      expect(xGrantIsCurrent(partial.join(" "))).toBe(false)
    }
  })

  it("rejects an empty grant", () => {
    expect(xGrantIsCurrent("")).toBe(false)
  })
})

// Deliberately the narrow question, not the whole list: this is what decides
// whether a share request would be rejected, and it must not start refusing
// publishes because some unrelated scope was added to X_SCOPES afterwards.
describe("hasXPublishScope", () => {
  it("is true only for a grant that actually carries tweet.write", () => {
    expect(hasXPublishScope("tweet.write")).toBe(true)
  })

  // **The lock.** Every connection this app can currently make is granted
  // X_SCOPES, which no longer includes the write scope — so the publish gate
  // can never open on a token minted from here, whatever else changes.
  it("is false for the grant this app actually requests", () => {
    expect(hasXPublishScope(X_SCOPES.join(" "))).toBe(false)
    expect(hasXPublishScope("")).toBe(false)
  })

  // A substring is not a scope. `tweet.read` contains neither, but a naive
  // `includes` on the raw string would match "tweet.write" inside a longer
  // token — the parse splits first for exactly this reason.
  it("matches whole scopes, not substrings", () => {
    expect(hasXPublishScope("not.tweet.write")).toBe(false)
    expect(hasXPublishScope("tweet.write.extra")).toBe(false)
  })
})
