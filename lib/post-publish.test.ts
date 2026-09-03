import { describe, expect, it } from "vitest"

import { canAttemptPublish, publishBlockedReason } from "@/lib/post-publish"
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

  it("refuses a platform with no flow behind it", () => {
    expect(
      publishBlockedReason(post({ platform: "x" }), [account({ platform: "x" })])
    ).toBe("platform_unsupported")
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
