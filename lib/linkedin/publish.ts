import {
  LINKEDIN_PUBLISH_SCOPE,
  parseGrantedScopes,
} from "@/lib/linkedin/scopes"
import { isNetworkError } from "@/lib/network-error"
import type { PublishFailure } from "@/lib/publish-failure"
import { isLivePublishEnabled } from "@/lib/publish-gate"

// The LinkedIn publishing path — **live**, and the only one that is.
//
// This said "built, and deliberately unreachable" until 2026-09-03, when
// AGENTS.md's hard publishing constraint was explicitly green-lit for LinkedIn
// and two real posts went out. It can fire: the gate's remaining key is
// `PRESTO_ENABLE_LIVE_PUBLISH`, which is unset by default and is a deliberate
// act rather than configuration (see `checkPublishGate`). The constraint itself
// is unchanged — calling a share endpoint, or wiring a scheduler to one, still
// needs asking first, every time.
//
// Its X sibling (lib/x/publish.ts) is the one that is now built and
// unreachable, which is where this file's old comment has gone to live.
//
// Server-only at runtime: callers hand it a decrypted access token, which must
// never exist in a client component. Nothing in this file may be imported by
// one except as a type.

// Re-exported so a reader of the publish path finds the scope it needs
// without a hop. It is *defined* in scopes.ts, beside the list that requests
// it — see the note there on what adding it cost.
export { LINKEDIN_PUBLISH_SCOPE }

// Both re-exported for the readers that have always found them here. The gate
// switch is shared with X (lib/publish-gate.ts — one switch, both platforms)
// and the failure vocabulary now lives in the pure module client components
// read (lib/publish-failure.ts), so neither is defined in this file any more.
export { isLivePublishEnabled }
export type { PublishFailure }

const POSTS_URL = "https://api.linkedin.com/rest/posts"

// LinkedIn versions its API by month and rejects a request with no version
// header. Pinned rather than derived from the clock: a silently-rolling
// version means the request shape can start failing on a date nobody chose.
const LINKEDIN_VERSION = "202608"

export type PublishResult =
  | { ok: true; postUrn: string }
  // **The post is live and we have no handle on it.** LinkedIn accepted the
  // share (a 2xx) but the response carried no `x-restli-id`, so there is no
  // URN to store. Deliberately *not* `{ ok: false, failure: "publish" }`,
  // which is what this used to return: that reads as "nothing was published",
  // and the caller then releases the claim and leaves the post retryable — so
  // the next attempt puts a second copy on the member's timeline. It is the
  // same hazard `record_failed` closes for the database-write path, and it was
  // sitting one function away on the response-parsing path.
  | { ok: false; failure: "published_without_urn" }
  | { ok: false; failure: PublishFailure }

export function hasPublishScope(raw: string): boolean {
  return parseGrantedScopes(raw).has(LINKEDIN_PUBLISH_SCOPE)
}

// The author of a share is the member's own URN, built from the OIDC `sub`
// stored as social_accounts.provider_account_id at connect time. Already in
// the database for every connected row — no migration was needed for this.
export function personUrn(providerAccountId: string): string {
  return `urn:li:person:${providerAccountId}`
}

// What the gate needs to know about the connection being published through.
export interface PublishableAccount {
  providerAccountId: string
  scope: string
  expiresAt: Date
}

// The gate. Two independent keys, and the first is still not turned:
//
//   1. `PRESTO_ENABLE_LIVE_PUBLISH` is unset, so this returns
//      "publishing_disabled" — the user's own explicit act, not a code change.
//   2. A connection made before w_member_social was requested (2026-09-02)
//      carries no such grant, so this returns "scope_not_granted" until the
//      member reconnects. Key 1 is the one that stays shut by default.
//
// They are checked in that order so the reason reported is the one the reader
// can act on first, and they are deliberately not collapsed into a single
// boolean: a mistake that flips one key must not be enough on its own.
export function checkPublishGate(
  account: PublishableAccount,
  now: Date
): { allowed: true } | { allowed: false; failure: PublishFailure } {
  if (!isLivePublishEnabled()) {
    return { allowed: false, failure: "publishing_disabled" }
  }

  if (!hasPublishScope(account.scope)) {
    return { allowed: false, failure: "scope_not_granted" }
  }

  // A 60-day token that has lapsed cannot be refreshed for a standard app —
  // the member re-authorizes. Checked here so an expired connection reads as
  // itself rather than as an opaque 401 from the API.
  if (account.expiresAt.getTime() <= now.getTime()) {
    return { allowed: false, failure: "token_expired" }
  }

  return { allowed: true }
}

// The share call itself. **Never reachable without passing `checkPublishGate`
// first** — that is the caller's contract. The only caller is
// lib/publish-runner.ts, which both the "Publish now" action and the cron
// route go through. Kept as its own function rather than inlined so the gate
// cannot be accidentally reordered after the request.
//
// The request shape follows LinkedIn's Posts API (rest/posts, versioned) and
// **is verified against live calls**: two posts were published on 2026-09-03
// under an explicit green-light, one by hand and one by a hand-fired scheduler
// tick. So this is known-good for a plain text share; everything past that
// (media, articles, visibility other than the default) is still untried.
async function postShare(
  accessToken: string,
  authorUrn: string,
  commentary: string
): Promise<PublishResult> {
  let response: Response
  try {
    response = await fetch(POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: authorUrn,
        commentary,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
      cache: "no-store",
    })
  } catch (error) {
    return { ok: false, failure: isNetworkError(error) ? "network" : "publish" }
  }

  if (!response.ok) return { ok: false, failure: "publish" }

  // The created post's URN comes back in a header, not the body (the body is
  // empty on a 201). Worth keeping: it is the only handle on the live post.
  //
  // Its absence does not mean the share failed — the 2xx above already said it
  // succeeded. It means we cannot name what we just created, which is a
  // different and worse thing: see `published_without_urn` on PublishResult.
  const postUrn = response.headers.get("x-restli-id")
  if (!postUrn) return { ok: false, failure: "published_without_urn" }

  return { ok: true, postUrn }
}

// The one entry point. Gate, then — and only then — the request.
export async function publishTextPost(input: {
  account: PublishableAccount
  accessToken: string
  content: string
  now?: Date
}): Promise<PublishResult> {
  const gate = checkPublishGate(input.account, input.now ?? new Date())
  if (!gate.allowed) return { ok: false, failure: gate.failure }

  return postShare(
    input.accessToken,
    personUrn(input.account.providerAccountId),
    input.content
  )
}
