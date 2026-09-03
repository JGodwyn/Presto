import { describe, expect, it } from "vitest"

import {
  connectedPlatforms,
  nextPostAccount,
  postAccountCycle,
  PLATFORM_LABELS,
  resolvePostAccount,
  TRY_OUT_LABEL,
} from "@/lib/post-account"
import type { ConnectedSocialAccount } from "@/types/social-account"

function account(
  overrides: Partial<ConnectedSocialAccount> = {}
): ConnectedSocialAccount {
  return {
    id: crypto.randomUUID(),
    platform: "linkedin",
    accountName: "Godwin John",
    accountEmail: null,
    avatarUrl: null,
    connectedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    scope: "email,openid,profile",
    status: "active",
    lastCheckedAt: null,
    ...overrides,
  }
}

describe("resolvePostAccount", () => {
  it("names the connected account rather than the platform", () => {
    const resolved = resolvePostAccount(
      { platform: "linkedin", isTryout: false },
      [account()]
    )
    expect(resolved.label).toBe("Godwin John")
    expect(resolved.connected).toBe(true)
  })

  it("falls back to the platform label when nothing is connected", () => {
    const resolved = resolvePostAccount(
      { platform: "x", isTryout: false },
      [account({ platform: "linkedin" })]
    )
    expect(resolved.label).toBe(PLATFORM_LABELS.x)
    expect(resolved.connected).toBe(false)
  })

  // The whole reason posts.is_tryout exists: the platform column says
  // "linkedin" either way, so without the flag a throwaway post would render
  // under the user's real name.
  it("names a try-out post as such, never the account behind its platform", () => {
    const resolved = resolvePostAccount(
      { platform: "linkedin", isTryout: true },
      [account()]
    )
    expect(resolved.label).toBe(TRY_OUT_LABEL)
    expect(resolved.isTryout).toBe(true)
    expect(resolved.connected).toBe(false)
  })

  it("prefers the platform label to an account row with a blank name", () => {
    const resolved = resolvePostAccount(
      { platform: "linkedin", isTryout: false },
      [account({ accountName: "   " })]
    )
    expect(resolved.label).toBe(PLATFORM_LABELS.linkedin)
  })
})

describe("connectedPlatforms", () => {
  it("is empty with nothing connected", () => {
    expect(connectedPlatforms([])).toEqual([])
  })

  it("reports each platform once", () => {
    expect(
      connectedPlatforms([
        account({ platform: "linkedin" }),
        account({ platform: "x" }),
      ])
    ).toEqual(["linkedin", "x"])
  })
})

describe("nextPostAccount", () => {
  const linkedinPost = { platform: "linkedin", isTryout: false } as const
  const both = [account({ platform: "linkedin" }), account({ platform: "x" })]

  // The reason Try out is in the cycle at all: one connected account is the
  // common case, and excluding it left the pill permanently static there.
  it("cycles between the one connected account and Try out", () => {
    const accounts = [account({ platform: "linkedin" })]
    expect(nextPostAccount(linkedinPost, accounts)).toEqual({
      platform: "linkedin",
      isTryout: true,
    })
    expect(
      nextPostAccount({ platform: "linkedin", isTryout: true }, accounts)
    ).toEqual({ platform: "linkedin", isTryout: false })
  })

  it("has nowhere to go with nothing connected — Try out is the only position", () => {
    expect(nextPostAccount(linkedinPost, [])).toBeNull()
  })

  it("wraps through Try out, LinkedIn and X in the menu's own order", () => {
    // Try out leads (account-options.tsx's order), so from X the cycle wraps
    // back to it rather than to LinkedIn.
    expect(nextPostAccount({ platform: "x", isTryout: false }, both)).toEqual({
      platform: "x",
      isTryout: true,
    })
    expect(
      nextPostAccount({ platform: "x", isTryout: true }, both)
    ).toEqual({ platform: "linkedin", isTryout: false })
    expect(nextPostAccount(linkedinPost, both)).toEqual({
      platform: "x",
      isTryout: false,
    })
  })

  // Switching to Try out and back must not lose which platform the post is
  // written for, so a Try out position carries the post's own platform.
  it("keeps the post's platform when moving onto Try out", () => {
    const next = nextPostAccount({ platform: "x", isTryout: false }, both)
    expect(next).toEqual({ platform: "x", isTryout: true })
  })

  it("enters the cycle at the first position when its platform is gone", () => {
    // Its own platform was disconnected since generation, so it is not a
    // position in the cycle — findIndex returns -1 and it enters at the top.
    const accounts = [account({ platform: "x" })]
    expect(nextPostAccount(linkedinPost, accounts)).toEqual({
      platform: "linkedin",
      isTryout: true,
    })
  })
})

describe("postAccountCycle", () => {
  it("leads with Try out, then connected platforms in menu order", () => {
    const cycle = postAccountCycle(
      [account({ platform: "x" }), account({ platform: "linkedin" })],
      "linkedin"
    )
    expect(cycle).toEqual([
      { platform: "linkedin", isTryout: true },
      { platform: "linkedin", isTryout: false },
      { platform: "x", isTryout: false },
    ])
  })

  it("omits a platform that isn't connected", () => {
    expect(postAccountCycle([account({ platform: "linkedin" })], "x")).toEqual([
      { platform: "x", isTryout: true },
      { platform: "linkedin", isTryout: false },
    ])
  })
})
