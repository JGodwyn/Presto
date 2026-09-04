import { describe, expect, it } from "vitest"

import {
  isRecordFailure,
  publishErrorFor,
  publishFailedLabel,
  publishFailureMessage,
  RECORD_FAILED_PREFIX,
} from "@/lib/publish-failure"
import { publishBlockedReason } from "@/lib/post-publish"
import type { ConnectedSocialAccount } from "@/types/social-account"
import type { Post } from "@/types/post"

const URN = "urn:li:share:7123456789"
const MARKER = `${RECORD_FAILED_PREFIX}${URN}`

describe("record_failed reads as published, not as a failure", () => {
  it("says the post published rather than inviting a retry", () => {
    expect(publishFailureMessage(MARKER)).toContain("published")
    expect(publishFailureMessage(MARKER)).not.toContain("didn't go out")
    expect(publishFailedLabel(MARKER)).toBe("Sent, not recorded")
  })

  it("still calls an ordinary failure a failure", () => {
    expect(publishFailureMessage("token_expired")).toContain("expired")
    expect(publishFailedLabel("token_expired")).toBe("Didn't send")
    expect(isRecordFailure("token_expired")).toBe(false)
  })
})

// The regression this file exists for. `publishErrorFor` was correct, and the
// server action silently dropped the field it needs: `publishedUrn` is optional
// on the parameter type, so omitting it type-checked perfectly. The client then
// stored a bare "record_failed" while the row held "record_failed:<urn>", and
// the card said "Didn't send" under a toast saying the post had published —
// then changed its story on reload.
describe("what the client mirrors matches what the server wrote", () => {
  it("reproduces the server's marker exactly when the URN is passed through", () => {
    const fromAction = { failure: "record_failed", publishedUrn: URN }

    expect(publishErrorFor(fromAction)).toBe(MARKER)
    expect(isRecordFailure(publishErrorFor(fromAction))).toBe(true)
  })

  it("would disagree with the row if the URN were dropped — the bug itself", () => {
    const withoutUrn = { failure: "record_failed" }

    // Documents *why* the field must cross the action boundary: with it gone,
    // the mirrored value is not a marker at all and every reader misclassifies.
    expect(publishErrorFor(withoutUrn)).not.toBe(MARKER)
    expect(isRecordFailure(publishErrorFor(withoutUrn))).toBe(false)
  })

  it("passes an ordinary failure through untouched", () => {
    expect(publishErrorFor({ failure: "token_expired" })).toBe("token_expired")
    expect(publishErrorFor({})).toBe("publish")
  })
})

describe("a live-but-unrecorded post is not offered for publishing", () => {
  const account = { platform: "linkedin" } as ConnectedSocialAccount
  const base = {
    platform: "linkedin",
    isTryout: false,
    publishedAt: null,
    publishError: null,
  } as Pick<Post, "platform" | "isTryout" | "publishedAt" | "publishError">

  it("blocks it, even though published_at is null", () => {
    expect(publishBlockedReason({ ...base, publishError: MARKER }, [account])).toBe(
      "already_published"
    )
  })

  it("still offers an ordinary failed post, which really can be retried", () => {
    expect(
      publishBlockedReason({ ...base, publishError: "token_expired" }, [account])
    ).toBeNull()
  })
})
