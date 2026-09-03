import { beforeEach, describe, expect, it, vi } from "vitest"

import { CLAIM_TIMEOUT_MS, publishOnePost } from "@/lib/publish-runner"
import { PUBLISH_GRACE_MINUTES } from "@/lib/publish-due"

// The share call is the one thing a test must never actually make.
const publishTextPost = vi.fn()

vi.mock("@/lib/linkedin/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/linkedin/publish")>()),
  publishTextPost: (...args: unknown[]) => publishTextPost(...args),
  checkPublishGate: () => ({ allowed: true }) as const,
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

  const client = {
    updates,
    from(table: string) {
      const builder: Record<string, unknown> = {}
      let payload: Record<string, unknown> | null = null

      const self = () => builder
      for (const method of ["select", "eq", "is", "or"]) builder[method] = self

      builder.update = (values: Record<string, unknown>) => {
        payload = values
        updates.push({ table, ...values })
        return builder
      }

      builder.maybeSingle = async () => {
        if (payload !== null) {
          // The claim: granted unless the row is already published.
          return post.published_at === null
            ? { data: { id: POST.postId }, error: null }
            : { data: null, error: null }
        }
        return table === "posts"
          ? { data: post, error: null }
          : {
              data: {
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

    // Exactly two writes are attempted: the claim, then the record write that
    // fails. The failed write's own payload nulls publish_started_at, but it
    // never lands — what matters is that no *further* update is issued to
    // release the claim, which is what would offer the post back to the next
    // tick.
    const postUpdates = supabase.updates.filter((update) => update.table === "posts")
    expect(postUpdates).toHaveLength(2)
    expect(postUpdates[0].publish_started_at).toBe(NOW.toISOString())
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
