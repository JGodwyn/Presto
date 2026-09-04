import { describe, expect, it } from "vitest"

import {
  hasXPublishScope,
  X_PUBLISH_SCOPE,
  X_SCOPES,
  xGrantIsCurrent,
} from "@/lib/x/scopes"

// This block replaces the tripwire that used to live in oauth.test.ts —
// "never requests a write scope", which pinned AGENTS.md's hard publishing
// constraint for as long as X publishing was unbuilt. It fired, loudly, the
// moment tweet.write was added, which is exactly what it was for. Deleting it
// would have thrown away the guarantee; what replaces it pins the *new*
// intended set, so a careless edit is still caught in both directions.
describe("X_SCOPES", () => {
  it("is exactly the set this app intends to hold", () => {
    // Written out rather than derived, so widening the list is a deliberate
    // edit here as well as there. `tweet.write` was green-lit on 2026-09-04;
    // anything beyond these four needs the same conversation.
    expect([...X_SCOPES].sort()).toEqual([
      "offline.access",
      "tweet.read",
      "tweet.write",
      "users.read",
    ])
  })

  it("requests exactly one write capability, and it is posting", () => {
    const writeScopes = X_SCOPES.filter((scope) => scope.includes("write"))
    expect(writeScopes).toEqual([X_PUBLISH_SCOPE])
    expect(X_PUBLISH_SCOPE).toBe("tweet.write")
  })

  it("requests offline.access, without which the connection dies in 2 hours", () => {
    expect(X_SCOPES).toContain("offline.access")
  })

  // Nothing here asks to read someone's timeline, follow, DM or delete. Those
  // are separate X scopes and none is requested; a list that grew one would
  // fail the exact-set assertion above, and this says why that matters.
  it("asks for nothing beyond signing in and posting", () => {
    for (const scope of ["tweet.moderate.write", "follows.write", "dm.write"]) {
      expect(X_SCOPES).not.toContain(scope)
    }
  })
})

describe("xGrantIsCurrent", () => {
  it("accepts a full grant whatever its order", () => {
    expect(xGrantIsCurrent(X_SCOPES.join(" "))).toBe(true)
    expect(xGrantIsCurrent([...X_SCOPES].reverse().join(" "))).toBe(true)
  })

  it("rejects the read-only grant every pre-2026-09-04 connection carries", () => {
    // Verbatim from the live exchange while X was sign-in-only. This is the
    // whole migration: tweet.write was added on 2026-09-04, so every connection
    // made before it is stale and has to reconnect — and the connected row says
    // so rather than letting it 401 later.
    expect(xGrantIsCurrent("users.read tweet.read offline.access")).toBe(false)
  })

  it("accepts a grant carrying more than is asked for", () => {
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
  it("is true for a grant carrying tweet.write and nothing else current", () => {
    expect(hasXPublishScope("tweet.write")).toBe(true)
    expect(hasXPublishScope(X_SCOPES.join(" "))).toBe(true)
  })

  it("is false for the sign-in-only grant", () => {
    expect(hasXPublishScope("users.read tweet.read offline.access")).toBe(false)
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
