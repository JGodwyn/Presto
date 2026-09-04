import { describe, expect, it } from "vitest"

import { exceedsPlatformLimit } from "@/lib/post-length"
import {
  canAttemptPublish,
  publishBlockedReason,
  publishComingSoon,
} from "@/lib/post-publish"
import type { Post } from "@/types/post"
import type { ConnectedSocialAccount } from "@/types/social-account"

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    projectId: "project-1",
    platform: "linkedin",
    status: "scheduled",
    content: "Something worth reading.",
    topics: [],
    scheduledFor: new Date("2026-09-10T09:00:00Z").toISOString(),
    createdAt: new Date("2026-09-01T09:00:00Z").toISOString(),
    isTryout: false,
    publishedAt: null,
    providerPostId: null,
    publishError: null,
    ...overrides,
  }
}

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
    connectedAt: new Date("2026-09-02T15:30:00Z").toISOString(),
    expiresAt: new Date("2026-11-01T15:30:00Z").toISOString(),
    scope: "email,openid,profile,w_member_social",
    status: "active",
    lastCheckedAt: null,
    ...overrides,
  }
}

describe("publishBlockedReason", () => {
  it("allows a connected, unpublished LinkedIn post", () => {
    expect(publishBlockedReason(post(), [account()])).toBeNull()
    expect(canAttemptPublish(post(), [account()])).toBe(true)
  })

  it("allows a draft — a post with no date can still be sent now", () => {
    expect(
      publishBlockedReason(post({ scheduledFor: null }), [account()])
    ).toBeNull()
  })

  // The one that would produce a *second* live post, so it is checked first
  // and reported ahead of everything else.
  it("refuses a post that has already gone out, whatever else is true of it", () => {
    const published = post({
      publishedAt: new Date("2026-09-02T10:00:00Z").toISOString(),
      providerPostId: "urn:li:share:123",
      isTryout: true,
      platform: "x",
    })
    expect(publishBlockedReason(published, [])).toBe("already_published")
  })

  it("refuses a try-out post, which borrows a real platform", () => {
    expect(publishBlockedReason(post({ isTryout: true }), [account()])).toBe(
      "tryout"
    )
  })

  // X publishing is built and switched off — see PUBLISHABLE_PLATFORMS. A
  // connected X account is therefore still refused, and refused for *this*
  // reason rather than "not connected", which is what drives the disabled
  // "coming soon" control instead of no control at all.
  it("refuses a connected X post, since X publishing is switched off", () => {
    expect(
      publishBlockedReason(post({ platform: "x" }), [account({ platform: "x" })])
    ).toBe("platform_unsupported")
  })

  it("refuses a platform with no flow behind it at all", () => {
    // Not a `PostPlatform`, which is the point: `posts.platform` is text in the
    // database, so a row can carry something this build has no publisher for —
    // and the client must not offer a control the server would only refuse.
    const unknown = post({ platform: "mastodon" as never })
    expect(
      publishBlockedReason(unknown, [account({ platform: "mastodon" as never })])
    ).toBe("platform_unsupported")
  })

  // The distinction the disabled control is built on: an X post has something
  // coming and shows a greyed-out row saying so; a published or try-out post
  // has nothing coming and shows no control at all.
  it("marks an X post as coming soon, and a spent post as not", () => {
    const xAccount = [account({ platform: "x" })]
    expect(publishComingSoon(post({ platform: "x" }), xAccount)).toBe(true)
    expect(
      publishComingSoon(post({ platform: "x", isTryout: true }), xAccount)
    ).toBe(false)
    expect(
      publishComingSoon(
        post({ platform: "x", publishedAt: "2026-09-01T00:00:00Z" }),
        xAccount
      )
    ).toBe(false)
    // And nothing about LinkedIn is coming soon — it publishes today.
    expect(publishComingSoon(post(), [account()])).toBe(false)
  })

  // Not belt-and-braces with the platform-switch guard: that one fires where a
  // post is *moved* to a platform, and cannot see a post written for X that came
  // back over the limit, or one edited past it afterwards. Both of those reach
  // this predicate, and — without it — reach X.
  // X is the only platform with a length limit and it isn't publishable today,
  // so this check has nothing live to refuse — it is kept, and kept tested,
  // because it is what stops an over-length post reaching X the day publishing
  // is switched back on. The platform check runs first, so the reason reported
  // for an X post is `platform_unsupported`; the length rule is asserted on its
  // own predicate instead.
  it("still knows an over-length post from one that fits", () => {
    expect(exceedsPlatformLimit("x".repeat(281), "x")).toBe(true)
    expect(exceedsPlatformLimit("x".repeat(280), "x")).toBe(false)
    expect(exceedsPlatformLimit(`  ${"x".repeat(280)}  `, "x")).toBe(false)
  })

  it("has no length opinion about a platform with no limit", () => {
    const long = post({ platform: "linkedin", content: "x".repeat(2000) })
    expect(publishBlockedReason(long, [account()])).toBeNull()
  })

  it("refuses when that platform isn't connected", () => {
    expect(publishBlockedReason(post(), [])).toBe("not_connected")
    expect(
      publishBlockedReason(post(), [account({ platform: "x" })])
    ).toBe("not_connected")
  })

  // Deliberate: the control is offered and the *attempt* explains itself.
  // Hiding it here would make an expired connection look like a missing
  // feature rather than something to reconnect.
  it("still allows an expired or revoked connection through", () => {
    const dead = account({
      status: "revoked",
      expiresAt: new Date("2026-08-01T00:00:00Z").toISOString(),
    })
    expect(publishBlockedReason(post(), [dead])).toBeNull()
  })

  // The gate is a server-only fact and must not leak into this predicate:
  // a post with no publish scope granted still offers the control, and the
  // refusal names the reason.
  it("does not consider the publish gate", () => {
    expect(
      publishBlockedReason(post(), [account({ scope: "email,openid,profile" })])
    ).toBeNull()
  })
})
