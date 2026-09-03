import { describe, expect, it } from "vitest"

import { grantIsCurrent, LINKEDIN_SCOPES, parseGrantedScopes } from "./scopes"

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
