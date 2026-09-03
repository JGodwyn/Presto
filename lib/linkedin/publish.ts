import {
  LINKEDIN_PUBLISH_SCOPE,
  parseGrantedScopes,
} from "@/lib/linkedin/scopes"
import { isNetworkError } from "@/lib/network-error"

// The LinkedIn publishing path — built, and deliberately unreachable.
//
// AGENTS.md's hard publishing constraint says Presto must not post to a live
// account until that is explicitly green-lit. This file exists so that the day
// it *is* green-lit, the work is a scope migration and a switch rather than a
// from-scratch build — but nothing here can fire today, and the two reasons it
// can't are independent (see `checkPublishGate`).
//
// Server-only at runtime: callers hand it a decrypted access token, which must
// never exist in a client component. Nothing in this file may be imported by
// one except as a type.

// Re-exported so a reader of the publish path finds the scope it needs
// without a hop. It is *defined* in scopes.ts, beside the list that requests
// it — see the note there on what adding it cost.
export { LINKEDIN_PUBLISH_SCOPE }

// The kill switch, and the "explicit confirm" half of the gate. Absent by
// default and absent from .env.local.example on purpose: it is not
// configuration, it is a deliberate act. Only ever read through
// `isLivePublishEnabled` so there is exactly one place that decides.
const LIVE_PUBLISH_ENV = "PRESTO_ENABLE_LIVE_PUBLISH"

const POSTS_URL = "https://api.linkedin.com/rest/posts"

// LinkedIn versions its API by month and rejects a request with no version
// header. Pinned rather than derived from the clock: a silently-rolling
// version means the request shape can start failing on a date nobody chose.
const LINKEDIN_VERSION = "202608"

// Every way publishing can decline or fail, as a short code the caller maps to
// copy. The first four are *refusals* — the gate said no and nothing left this
// process; the last two mean a request was actually made.
export type PublishFailure =
  | "publishing_disabled"
  | "scope_not_granted"
  | "token_expired"
  | "not_connected"
  | "network"
  | "publish"

export type PublishResult =
  | { ok: true; postUrn: string }
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

export function isLivePublishEnabled(): boolean {
  return process.env[LIVE_PUBLISH_ENV] === "true"
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
// first** — that is the caller's contract, and publish-actions.ts is the only
// caller. Kept as its own function rather than inlined so the gate cannot be
// accidentally reordered after the request.
//
// The request shape follows LinkedIn's Posts API (rest/posts, versioned) and
// is **unverified against a live call** — by construction, since nothing has
// ever been allowed to make one. Treat it as the starting point for the first
// real attempt, not as known-good.
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
  const postUrn = response.headers.get("x-restli-id")
  if (!postUrn) return { ok: false, failure: "publish" }

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
