import { describe, expect, it } from "vitest"

import { exceedsPlatformLimit } from "@/lib/post-length"
import {
  canAttemptPublish,
  isPostLocked,
  publishBlockedReason,
  publishComingSoon,
  UNLOCKED_PUBLISH_ERROR_FILTER,
} from "@/lib/post-publish"
import { RECORD_FAILED_PREFIX } from "@/lib/publish-failure"
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

// The read-only half. Four controls across three surfaces ask this, and the
// point of it being one function is that none of them can answer differently
// from `publishBlockedReason` above.
describe("isPostLocked", () => {
  it("leaves an ordinary queued post alone", () => {
    expect(isPostLocked(post())).toBe(false)
    expect(isPostLocked(post({ scheduledFor: null }))).toBe(false)
  })

  it("locks a published post", () => {
    expect(
      isPostLocked(post({ publishedAt: new Date("2026-09-03T10:00:00Z").toISOString() }))
    ).toBe(true)
  })

  // The trap: this post IS on someone's timeline, and `published_at` is null
  // because the write recording that failed. Reading `publishedAt` alone —
  // which every one of these surfaces used to do — leaves every control open
  // on it.
  it("locks a post that is live but unrecorded", () => {
    const live = post({
      publishError: `${RECORD_FAILED_PREFIX}urn:li:share:7501150776556412931`,
    })
    expect(live.publishedAt).toBeNull()
    expect(isPostLocked(live)).toBe(true)
  })

  // An ordinary failure means nothing went out, so everything about the post
  // is still editable — that is the whole point of "Didn't send".
  it("does not lock a post whose publish failed", () => {
    expect(isPostLocked(post({ publishError: "token_expired" }))).toBe(false)
    expect(isPostLocked(post({ publishError: "publish" }))).toBe(false)
  })

  // The pair must agree: anything locked is also refused a publish, or one
  // surface offers to send a post another surface says is already out.
  it("agrees with publishBlockedReason about what is already out", () => {
    for (const locked of [
      post({ publishedAt: new Date("2026-09-03T10:00:00Z").toISOString() }),
      post({ publishError: `${RECORD_FAILED_PREFIX}urn:li:share:1` }),
    ]) {
      expect(isPostLocked(locked)).toBe(true)
      expect(publishBlockedReason(locked, [account()])).toBe("already_published")
    }
  })
})

// The lock has to hold on the server, not only in the UI. The reported race:
// the post-details page keeps a load-time snapshot, so if the scheduler
// publishes while that page is open, every control is still live and an edit
// rewrites `posts.content` while the LinkedIn copy is untouched — exactly the
// drift the read-only treatment exists to prevent. A hidden button decides
// nothing; the server action has to refuse.
describe("UNLOCKED_PUBLISH_ERROR_FILTER", () => {
  it("spells out the NULL case, which is what makes it match normal posts", () => {
    // A bare `not.like` renders as `NOT (col LIKE …)`, which is NULL — not
    // true — for a NULL column, so it silently excludes every post that has
    // never failed. That mistake once disabled publishing outright.
    expect(UNLOCKED_PUBLISH_ERROR_FILTER).toContain("publish_error.is.null")
    expect(UNLOCKED_PUBLISH_ERROR_FILTER).toContain(
      `publish_error.not.like.${RECORD_FAILED_PREFIX}*`
    )
  })

  it("names the same marker isPostLocked tests for, so the two cannot drift", () => {
    const marker = `${RECORD_FAILED_PREFIX}urn:li:share:1`

    expect(isPostLocked({ publishedAt: null, publishError: marker })).toBe(true)
    expect(UNLOCKED_PUBLISH_ERROR_FILTER).toContain(RECORD_FAILED_PREFIX)
  })
})

describe("isPostLocked", () => {
  it("locks a published post", () => {
    expect(
      isPostLocked({ publishedAt: "2026-09-05T00:00:00Z", publishError: null })
    ).toBe(true)
  })

  it("locks a post that went out but could not be recorded", () => {
    expect(
      isPostLocked({
        publishedAt: null,
        publishError: `${RECORD_FAILED_PREFIX}urn:li:share:1`,
      })
    ).toBe(true)
  })

  it("leaves an ordinary failure editable, since it never went out", () => {
    expect(
      isPostLocked({ publishedAt: null, publishError: "token_expired" })
    ).toBe(false)
  })

  it("leaves an untouched post editable", () => {
    expect(isPostLocked({ publishedAt: null, publishError: null })).toBe(false)
  })
})
