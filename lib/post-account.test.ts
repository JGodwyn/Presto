import { describe, expect, it } from "vitest"

import {
  connectedPlatforms,
  nextAllowedPostAccount,
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
    accountHandle: null,
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

describe("handle-first labels", () => {
  it("labels an X post with the handle, not the display name", () => {
    const x = account({
      platform: "x",
      accountName: "Godwin",
      accountHandle: "gdwn__",
    })

    expect(
      resolvePostAccount({ platform: "x", isTryout: false }, [x]).label
    ).toBe("@gdwn__")
  })

  it("does not double the @ if one was ever stored", () => {
    const x = account({ platform: "x", accountHandle: "@gdwn__" })

    expect(
      resolvePostAccount({ platform: "x", isTryout: false }, [x]).label
    ).toBe("@gdwn__")
  })

  it("falls back to the display name when there is no handle", () => {
    const linkedin = account({
      platform: "linkedin",
      accountName: "Godwin John",
      accountHandle: null,
    })

    expect(
      resolvePostAccount({ platform: "linkedin", isTryout: false }, [linkedin])
        .label
    ).toBe("Godwin John")
  })
})

describe("nextPostAccount skipping refused positions", () => {
  const accounts = [
    account({ platform: "linkedin", accountName: "Godwin John" }),
    account({ platform: "x", accountHandle: "gdwn__" }),
  ]
  // The cycle is [Try out, LinkedIn, X], so from LinkedIn the only route to
  // Try out runs through X.
  const refusesX = (target: { platform: string; isTryout: boolean }) =>
    !target.isTryout && target.platform === "x"

  it("steps over a refused position instead of stopping at it", () => {
    const next = nextPostAccount(
      { platform: "linkedin", isTryout: false },
      accounts,
      refusesX
    )

    // Without the skip this returns X and the pill is a dead control: the
    // switch is refused and Try out becomes unreachable from LinkedIn.
    expect(next).toEqual({ platform: "linkedin", isTryout: true })
  })

  it("still offers a refused position when it is the only one left", () => {
    // From Try out the cycle's remaining entries are LinkedIn and X; refuse
    // both and there is nowhere to go, so the pill must stay live and say why
    // rather than silently doing nothing.
    const next = nextPostAccount({ platform: "x", isTryout: true }, accounts, () => true)

    expect(next).not.toBeNull()
  })

  it("is unchanged when nothing is refused", () => {
    expect(
      nextPostAccount({ platform: "linkedin", isTryout: false }, accounts)
    ).toEqual({ platform: "x", isTryout: false })
  })

  it("never refuses the Try out position", () => {
    // postAccountCycle gives Try out the post's own platform, so an X post's
    // Try out entry carries platform "x" — a naive limit check would refuse it.
    const next = nextPostAccount(
      { platform: "x", isTryout: false },
      accounts,
      (target) => !target.isTryout && target.platform === "x"
    )

    expect(next).toEqual({ platform: "x", isTryout: true })
  })
})

describe("nextAllowedPostAccount", () => {
  const accounts = [
    account({ platform: "linkedin", accountName: "Godwin John" }),
    account({ platform: "x", accountHandle: "gdwn__" }),
  ]
  const refusesX = (target: { platform: string; isTryout: boolean }) =>
    !target.isTryout && target.platform === "x"

  it("returns the position a post can actually move to", () => {
    expect(
      nextAllowedPostAccount(
        { platform: "linkedin", isTryout: false },
        accounts,
        refusesX
      )
    ).toEqual({ platform: "linkedin", isTryout: true })
  })

  it("is null when every position is refused — unlike nextPostAccount", () => {
    // The bug this exists to prevent: with only X connected and an over-length
    // Try-out post, every non-Try-out position is refused. nextPostAccount
    // hands back the refused one on purpose (so the pill stays live and can
    // explain itself); a "Skip to …" button built on that performs the very
    // switch its dialog opened to refuse.
    const onlyX = [account({ platform: "x", accountHandle: "gdwn__" })]
    const post = { platform: "x" as const, isTryout: true }

    expect(nextPostAccount(post, onlyX, refusesX)).not.toBeNull()
    expect(nextAllowedPostAccount(post, onlyX, refusesX)).toBeNull()
  })

  it("is null rather than refused when the only alternative is over the limit", () => {
    const onlyX = [account({ platform: "x", accountHandle: "gdwn__" })]

    expect(
      nextAllowedPostAccount({ platform: "x", isTryout: true }, onlyX, () => true)
    ).toBeNull()
  })
})
