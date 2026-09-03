import { describe, expect, it } from "vitest"

import {
  grantIsCurrent,
  isGrantStale,
  LINKEDIN_SCOPES,
  parseGrantedScopes,
} from "./scopes"

describe("parseGrantedScopes", () => {
  it("splits the comma-delimited form LinkedIn actually returns", () => {
    expect(parseGrantedScopes("email,openid,profile")).toEqual(
      new Set(["email", "openid", "profile"])
    )
  })

  it("splits the space-delimited form the scopes are sent in", () => {
    expect(parseGrantedScopes("openid profile email")).toEqual(
      new Set(["openid", "profile", "email"])
    )
  })

  // The delimiter flipping between what we send and what comes back is the
  // documented trap (FOLLOWUPS #5); a mixed string must not produce empties.
  it("handles a mixed and padded string without empty entries", () => {
    expect(parseGrantedScopes(" email, openid  profile ,")).toEqual(
      new Set(["email", "openid", "profile"])
    )
  })
})

describe("grantIsCurrent", () => {
  it("accepts a full grant whatever its order or delimiter", () => {
    // LinkedIn returns them comma-delimited and in its own order; both forms
    // of the same grant are current.
    expect(grantIsCurrent(LINKEDIN_SCOPES.join(","))).toBe(true)
    expect(
      grantIsCurrent([...LINKEDIN_SCOPES].reverse().join(" "))
    ).toBe(true)
  })

  it("rejects the sign-in-only grant every pre-2026-09-02 connection carries", () => {
    // Verbatim from the 2026-08-21 live exchange. This is the whole migration:
    // w_member_social was added to the requested list on 2026-09-02, so every
    // connection made before it is stale and has to reconnect — and the
    // connected row says so rather than letting it 401 later.
    expect(grantIsCurrent("email,openid,profile")).toBe(false)
  })

  it("accepts a grant carrying more than is asked for", () => {
    // The ask is "does it cover what we request", not "does it match exactly",
    // so a grant with an extra scope on it is still current.
    expect(grantIsCurrent(`${LINKEDIN_SCOPES.join(",")},r_extra_scope`)).toBe(
      true
    )
  })

  it("rejects a grant missing any requested scope", () => {
    for (const scope of LINKEDIN_SCOPES) {
      const partial = LINKEDIN_SCOPES.filter((other) => other !== scope)
      expect(grantIsCurrent(partial.join(","))).toBe(false)
    }
  })

  // The predicate must keep working the *next* time the list changes, not
  // just for the w_member_social case above — hence a scope-agnostic form.
  it("rejects a grant that predates a newly requested scope", () => {
    expect(grantIsCurrent(LINKEDIN_SCOPES.join(","))).toBe(true)
    expect(
      grantIsCurrent(LINKEDIN_SCOPES.slice(0, -1).join(","))
    ).toBe(false)
  })

  it("rejects an empty grant", () => {
    expect(grantIsCurrent("")).toBe(false)
  })
})

// The bug this exists to prevent: grantIsCurrent asks a LinkedIn question, and
// asking it of an X row compares X's scopes against a list containing
// w_member_social. Every connected X account then wore a permanent "Reconnect"
// chip, for a permission X is never asked for and that reconnecting could not
// clear — X went live on main while this branch was open, so the two only met
// at the merge.
describe("isGrantStale", () => {
  const X_GRANT = "users.read tweet.read offline.access"

  it("never calls a non-LinkedIn grant stale", () => {
    expect(isGrantStale("x", X_GRANT)).toBe(false)
    // Even an empty scope: LINKEDIN_SCOPES has nothing to say about it.
    expect(isGrantStale("x", "")).toBe(false)
  })

  it("still catches a LinkedIn grant made before the scope was added", () => {
    expect(isGrantStale("linkedin", "openid,profile,email")).toBe(true)
  })

  it("passes a current LinkedIn grant", () => {
    expect(isGrantStale("linkedin", LINKEDIN_SCOPES.join(" "))).toBe(false)
  })
})
