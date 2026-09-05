import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  CLAIM_TIMEOUT_MS,
  publishOnePost,
  RECORD_FAILED_PREFIX,
} from "@/lib/publish-runner"
import { PUBLISH_GRACE_MINUTES } from "@/lib/publish-due"

// The share calls are the one thing a test must never actually make. Both
// platforms are stubbed, and which one gets called is itself the assertion in
// the dispatch block at the bottom of this file.
const publishTextPost = vi.fn()
const publishTweet = vi.fn()
const getLiveXAccessToken = vi.fn()

vi.mock("@/lib/linkedin/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/linkedin/publish")>()),
  publishTextPost: (...args: unknown[]) => publishTextPost(...args),
  checkPublishGate: () => ({ allowed: true }) as const,
}))

vi.mock("@/lib/x/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/x/publish")>()),
  publishTweet: (...args: unknown[]) => publishTweet(...args),
  checkXPublishGate: () => ({ allowed: true }) as const,
}))

vi.mock("@/lib/x/token", () => ({
  getLiveXAccessToken: (...args: unknown[]) => getLiveXAccessToken(...args),
}))

vi.mock("@/lib/ai/key-crypto", () => ({
  decryptApiKey: () => "plaintext-token",
}))

const NOW = new Date("2026-09-03T12:00:00Z")
const POST = { projectId: "project", postId: "post" }

// A Supabase stand-in shaped exactly like the four chains the runner builds:
// read the post, read the account, claim, then record. Every builder returns
// itself so `.eq().eq().is().or()` chains, and the terminal shape decides what
// comes back — `maybeSingle()` for the first three, an awaited thenable for the
// final record write, which is the one whose error used to go unchecked.
function fakeSupabase({
  post,
  recordError = null,
}: {
  post: Record<string, unknown>
  recordError?: { message: string } | null
}) {
  const updates: Record<string, unknown>[] = []
  const filters: { method: string; args: unknown[] }[] = []
  // Every `.eq()` the runner builds, so a test can ask *which* connection was
  // read — the difference between publishing an X post through the X account
  // and through whatever row a hardcoded platform filter happened to find.
  const eqs: unknown[][] = []

  const client = {
    updates,
    filters,
    eqs,
    from(table: string) {
      const builder: Record<string, unknown> = {}
      let payload: Record<string, unknown> | null = null

      const self = () => builder
      builder.select = self
      builder.eq = (...args: unknown[]) => {
        eqs.push(args)
        return builder
      }
      // Recorded rather than merely chained: this fake models predicates in
      // JavaScript, which is exactly how it once passed a claim predicate that
      // the real database matched zero rows against (see the null-safety test
      // below). What the query *says* is testable here; what PostgREST does
      // with it is not.
      for (const method of ["is", "or", "not"]) {
        builder[method] = (...args: unknown[]) => {
          filters.push({ method, args })
          return builder
        }
      }

      builder.update = (values: Record<string, unknown>) => {
        payload = values
        updates.push({ table, ...values })
        return builder
      }

      builder.maybeSingle = async () => {
        if (payload !== null) {
          // The claim. Granted unless the row is already published, or is
          // marked live-but-unrecorded — the `.not(publish_error, like, …)`
          // predicate, which unlike the stale-claim window never expires.
          // Mirrors the null-safe predicate: a NULL publish_error passes, a
          // marked one does not.
          const blocked =
            post.published_at !== null ||
            String(post.publish_error ?? "").startsWith(RECORD_FAILED_PREFIX)
          return blocked
            ? { data: null, error: null }
            : { data: { id: POST.postId }, error: null }
        }
        return table === "posts"
          ? { data: post, error: null }
          : {
              data: {
                // Selected for X's sake: its token is fetched through
                // lib/x/token.ts rather than read off this row.
                id: "account-1",
                provider_account_id: "urn:li:person:1",
                scope: "openid profile email w_member_social",
                expires_at: new Date(NOW.getTime() + 86_400_000).toISOString(),
                encrypted_access_token: "sealed",
              },
              error: null,
            }
      }

      // The record write is the only update awaited directly — the claim ends
      // in `.select().maybeSingle()`, so it never comes through here.
      builder.then = (resolve: (value: unknown) => unknown) =>
        resolve({ error: table === "posts" ? recordError : null })

      return builder
    },
  }

  return client as unknown as Parameters<typeof publishOnePost>[0]
}

beforeEach(() => {
  publishTextPost.mockReset()
  publishTextPost.mockResolvedValue({ ok: true, postUrn: "urn:li:share:1" })
  publishTweet.mockReset()
  publishTweet.mockResolvedValue({ ok: true, postId: "1966000000000000000" })
  getLiveXAccessToken.mockReset()
  getLiveXAccessToken.mockResolvedValue({ ok: true, accessToken: "live-token" })
})

// The regression this file exists for. A claim that goes stale before its post
// ages out of the due window means a post whose send succeeded but whose record
// write failed gets picked up by a later tick and published a second time to a
// real timeline. The two constants used to be set independently — five minutes
// against a fifteen-minute window — which is exactly that overlap.
describe("the claim outlives the due window", () => {
  it("holds a claim for longer than a post can stay due", () => {
    expect(CLAIM_TIMEOUT_MS).toBeGreaterThan(PUBLISH_GRACE_MINUTES * 60 * 1000)
  })
})

// The bug this test exists for did not survive a code review, a full green
// suite, or a hand-rolled fake — because the fake re-implemented the predicate
// in JavaScript and got a different answer from the database.
//
// PostgREST renders `.not(col, "like", …)` as a bare `NOT (col LIKE …)`, which
// is NULL rather than true for a NULL column, so it silently excludes every row
// where the column is NULL. `publish_error` is NULL on every post that has
// never failed. Measured against the live database: the bare form matched 0 of
// 311 rows and the null-safe form matched all 311 — publishing was entirely,
// silently dead, reporting "already being published" for every post.
//
// This asserts on the predicate as written, since that is the part a fake can
// speak to honestly.
describe("the claim predicate is null-safe", () => {
  it("never filters publish_error without an explicit is.null arm", async () => {
    const supabase = fakeSupabase({
      post: {
        id: POST.postId,
        platform: "linkedin",
        content: "Anything.",
        is_tryout: false,
        published_at: null,
      },
    }) as unknown as { filters: { method: string; args: unknown[] }[] }

    await publishOnePost(supabase as never, POST, NOW)

    const mentioningPublishError = supabase.filters.filter(({ args }) =>
      args.some((arg) => String(arg).includes("publish_error"))
    )

    expect(mentioningPublishError).not.toHaveLength(0)
    for (const filter of mentioningPublishError) {
      // A bare `.not(...)` on this column cannot be null-safe, whatever the
      // pattern; the null case has to be spelled out.
      expect(filter.method).not.toBe("not")
      expect(String(filter.args[0])).toContain("publish_error.is.null")
    }
  })
})

// LinkedIn accepted the share and returned no x-restli-id. The post is live and
// unnameable. This used to come back as a plain `publish` failure, which
// released the claim and left the post retryable — so the next attempt put a
// second copy on the member's timeline. Exactly the hazard record_failed closes
// for the database-write path, one function away on the response-parsing path.
describe("publishOnePost when the share succeeds without a URN", () => {
  const livePost = {
    id: POST.postId,
    platform: "linkedin",
    content: "Live, unnameable.",
    is_tryout: false,
    published_at: null,
  }

  it("reports record_failed, not a publish failure", async () => {
    publishTextPost.mockResolvedValue({
      ok: false,
      failure: "published_without_urn",
    })
    const supabase = fakeSupabase({ post: livePost })

    const outcome = await publishOnePost(supabase, POST, NOW)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.failure).toBe("record_failed")
  })

  it("marks the row and never releases the claim", async () => {
    publishTextPost.mockResolvedValue({
      ok: false,
      failure: "published_without_urn",
    })
    const supabase = fakeSupabase({ post: livePost }) as unknown as {
      updates: Record<string, unknown>[]
    }

    await publishOnePost(supabase as never, POST, NOW)

    const postUpdates = supabase.updates.filter((u) => u.table === "posts")
    // The marker carries no URN — there isn't one — but it is still a marker,
    // and `%` matches a zero-length suffix, so the claim predicate blocks it.
    const marker = postUpdates.find(
      (u) => u.publish_error === RECORD_FAILED_PREFIX
    )
    expect(marker).toBeDefined()
    // Nothing after the claim may null publish_started_at.
    for (const update of postUpdates.slice(1)) {
      expect(update).not.toHaveProperty("publish_started_at", null)
    }
  })
})

describe("publishOnePost when the record write fails", () => {
  const livePost = {
    id: POST.postId,
    platform: "linkedin",
    content: "Live somewhere.",
    is_tryout: false,
    published_at: null,
  }

  it("reports record_failed rather than success", async () => {
    const supabase = fakeSupabase({
      post: livePost,
      recordError: { message: "write failed" },
    })

    const outcome = await publishOnePost(supabase, POST, NOW)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.failure).toBe("record_failed")
  })

  it("carries the URN out, since the row no longer holds it", async () => {
    const supabase = fakeSupabase({
      post: livePost,
      recordError: { message: "write failed" },
    })

    const outcome = await publishOnePost(supabase, POST, NOW)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.publishedUrn).toBe("urn:li:share:1")
  })

  // The post is live. Releasing the claim would offer it straight back to the
  // next tick, which would publish it again — so the claim is deliberately kept.
  it("does not release the claim, so nothing can re-send the post", async () => {
    const supabase = fakeSupabase({
      post: livePost,
      recordError: { message: "write failed" },
    }) as unknown as { updates: Record<string, unknown>[] }

    await publishOnePost(supabase as never, POST, NOW)

    // Three writes are attempted: the claim, the record write that fails, and
    // the marker. The failed write's own payload nulls publish_started_at, but
    // it never lands — what matters is that no write *after* it releases the
    // claim, which is what would offer the post back to a later attempt.
    const postUpdates = supabase.updates.filter((update) => update.table === "posts")
    expect(postUpdates[0].publish_started_at).toBe(NOW.toISOString())

    const afterTheFailedWrite = postUpdates.slice(2)
    expect(afterTheFailedWrite).not.toHaveLength(0)
    for (const update of afterTheFailedWrite) {
      expect(update).not.toHaveProperty("publish_started_at", null)
    }
  })

  // The hole in the first version of this fix. "Leave the claim held" is not a
  // permanent block: the claim predicate re-grants a claim older than
  // CLAIM_TIMEOUT_MS, so holding it only bought sixteen minutes. The cron never
  // noticed — the post has left its due window by then — but the manual
  // "Publish now" path does not look at the date at all, so a person clicking
  // it later re-sent a post already on their timeline.
  it("marks the row so no later attempt can ever re-claim it", async () => {
    const supabase = fakeSupabase({
      post: livePost,
      recordError: { message: "write failed" },
    }) as unknown as { updates: Record<string, unknown>[] }

    await publishOnePost(supabase as never, POST, NOW)

    const marker = supabase.updates.find((update) =>
      String(update.publish_error ?? "").startsWith(RECORD_FAILED_PREFIX)
    )
    expect(marker).toBeDefined()
    // The URN travels inside the marker: once the published_at write has
    // failed, this is the only durable record that the post is live.
    expect(marker?.publish_error).toBe(`${RECORD_FAILED_PREFIX}urn:li:share:1`)
  })

  it("refuses a marked post outright, however long has passed", async () => {
    const supabase = fakeSupabase({
      post: {
        ...livePost,
        publish_error: `${RECORD_FAILED_PREFIX}urn:li:share:1`,
      },
    })

    // Well past the claim lease, which is exactly when the old fix let go.
    const later = new Date(NOW.getTime() + CLAIM_TIMEOUT_MS * 10)
    const outcome = await publishOnePost(supabase, POST, later)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.failure).toBe("claimed")
    expect(publishTextPost).not.toHaveBeenCalled()
  })

  it("reports the release write's own failure rather than claiming it recorded", async () => {
    publishTextPost.mockResolvedValue({ ok: false, failure: "publish" })
    const supabase = fakeSupabase({
      post: livePost,
      recordError: { message: "write failed" },
    })

    const outcome = await publishOnePost(supabase, POST, NOW)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.failure).toBe("publish")
    // The write that would have recorded the failure failed too, so the row
    // never got the marker and a caller must not pretend otherwise.
    expect(outcome.recorded).toBe(false)
  })

  it("still reports success when the record write lands", async () => {
    const supabase = fakeSupabase({ post: livePost })

    const outcome = await publishOnePost(supabase, POST, NOW)

    expect(outcome.ok).toBe(true)
  })

  it("never reaches LinkedIn for a post that already published", async () => {
    const supabase = fakeSupabase({
      post: { ...livePost, published_at: NOW.toISOString() },
    })

    const outcome = await publishOnePost(supabase, POST, NOW)

    expect(outcome.ok).toBe(false)
    expect(publishTextPost).not.toHaveBeenCalled()
  })
})

// The dispatch, and the switch in front of it.
//
// `lib/x/publish.ts` is complete and was exercised against the live X API, but
// X is not in PUBLISHABLE_PLATFORMS: posting costs money, metered per app
// across every user of Presto, and the owner's decision was not to pay. So the
// runner refuses an X post before it reaches any of that — the same state
// lib/linkedin/publish.ts sat in for months before LinkedIn was green-lit.
//
// These tests pin the switch, not the plumbing. `publishTweet` keeps its own
// suite (lib/x/publish.test.ts), which is where the send path stays covered
// while it is unreachable from here.
describe("publishOnePost refuses a platform that is switched off", () => {
  const xPost = {
    id: POST.postId,
    platform: "x",
    content: "A tweet that isn't going anywhere.",
    is_tryout: false,
    published_at: null,
  }

  const linkedinPost = { ...xPost, platform: "linkedin", content: "A share." }

  it("never reaches X, and never asks for an X token", async () => {
    const supabase = fakeSupabase({ post: xPost })

    const outcome = await publishOnePost(supabase, POST, NOW)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.failure).toBe("unsupported_platform")
    expect(publishTweet).not.toHaveBeenCalled()
    // The token matters as much as the send: X's refresh tokens are rotating
    // and single-use, so even fetching one for a post that cannot go out
    // spends something.
    expect(getLiveXAccessToken).not.toHaveBeenCalled()
  })

  it("refuses before taking the claim, so nothing is left held", async () => {
    const supabase = fakeSupabase({ post: xPost }) as unknown as {
      updates: Record<string, unknown>[]
    }

    await publishOnePost(supabase as never, POST, NOW)

    expect(supabase.updates).toHaveLength(0)
  })

  // The refusal has to survive the gate being opened — the switch is the list,
  // not the environment variable.
  it("still refuses with live publishing switched on", async () => {
    process.env.PRESTO_ENABLE_LIVE_PUBLISH = "true"
    try {
      const supabase = fakeSupabase({ post: xPost })
      const outcome = await publishOnePost(supabase, POST, NOW)
      expect(outcome.ok).toBe(false)
      expect(publishTweet).not.toHaveBeenCalled()
    } finally {
      delete process.env.PRESTO_ENABLE_LIVE_PUBLISH
    }
  })

  it("still publishes LinkedIn, which is the platform that is on", async () => {
    const supabase = fakeSupabase({ post: linkedinPost })

    const outcome = await publishOnePost(supabase, POST, NOW)

    expect(publishTextPost).toHaveBeenCalledTimes(1)
    expect(publishTweet).not.toHaveBeenCalled()
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.platform).toBe("linkedin")
  })

  it("reads the connection for the post's own platform", async () => {
    const supabase = fakeSupabase({ post: linkedinPost }) as unknown as {
      eqs: unknown[][]
    }

    await publishOnePost(supabase as never, POST, NOW)

    expect(supabase.eqs).toContainEqual(["platform", "linkedin"])
  })

  it("refuses a platform it has never had a publisher for", async () => {
    const supabase = fakeSupabase({ post: { ...xPost, platform: "mastodon" } })

    const outcome = await publishOnePost(supabase, POST, NOW)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.failure).toBe("unsupported_platform")
      expect(outcome.platform).toBeNull()
    }
  })
})

// The length refusal has nothing live to refuse while X is off — LinkedIn has
// no limit this app enforces — but it is what stops an over-length post
// reaching X the day publishing is switched back on, so it stays tested.
describe("publishOnePost refuses an over-length post", () => {
  it("has no length opinion about LinkedIn", async () => {
    const supabase = fakeSupabase({
      post: {
        id: POST.postId,
        platform: "linkedin",
        content: "x".repeat(2000),
        is_tryout: false,
        published_at: null,
      },
    })

    const outcome = await publishOnePost(supabase, POST, NOW)

    expect(outcome.ok).toBe(true)
  })
})
