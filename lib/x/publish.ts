import { isNetworkError } from "@/lib/network-error"
import { isLivePublishEnabled } from "@/lib/publish-gate"
import type { PublishFailure } from "@/lib/publish-failure"
import { hasXPublishScope, X_PUBLISH_SCOPE } from "@/lib/x/scopes"

// The X publishing path — **built, exercised against the live API, and
// currently unreachable.**
//
// X is not in `PUBLISHABLE_PLATFORMS` (lib/post-publish.ts), so
// lib/publish-runner.ts refuses an X post before anything here is called.
// That is a cost decision rather than missing work: posting through X's v2 API
// is metered per *app* across every user of Presto, and the first real send
// came back `402 credits depleted`. Everything below is known-good up to and
// including X receiving a request; only the 201-and-read-the-id path has never
// run for real. Nothing here is deleted so that switching X on is a list, a
// scope and a reconnect rather than a rebuild — the state lib/linkedin/
// publish.ts sat in before LinkedIn was green-lit.
//
// The sibling of lib/linkedin/publish.ts, deliberately not an abstraction
// over it. The two share the *hazards* (see the gate and
// `published_without_urn` below, both of which are copied on purpose) and
// almost nothing else: X takes a JSON body and returns the created post's id in
// that body, where LinkedIn returns it in a header; X's access tokens live two
// hours and are renewed by lib/x/token.ts rather than being read straight off
// the row; X has no concept of a share's visibility or distribution.
//
// Server-only at runtime: callers hand it a decrypted access token, which must
// never exist in a client component. Nothing in this file may be imported by
// one except as a type. lib/ai/no-client-sdk.test.ts pins that.

// Re-exported so a reader of the publish path finds the scope it needs without
// a hop. It is *defined* in scopes.ts, beside the list that requests it — see
// the note there on what adding it cost.
export { X_PUBLISH_SCOPE }

const TWEETS_URL = "https://api.x.com/2/tweets"

export type XPublishResult =
  | { ok: true; postId: string }
  // **The post is live and we have no handle on it.** X accepted the request
  // (a 2xx) and the body carried no `data.id` — or was not readable at all.
  // Deliberately *not* an ordinary failure: that reads as "nothing was
  // published", and the runner then releases the claim and leaves the post
  // retryable, which puts a second copy on the timeline. Identical hazard to
  // LinkedIn's missing `x-restli-id`, arrived at down a different route.
  | { ok: false; failure: "published_without_urn" }
  | { ok: false; failure: PublishFailure }

// What the gate needs to know about the connection being published through.
//
// Note what is *not* here: an expiry. LinkedIn's gate refuses a lapsed 60-day
// token because nothing can renew it. X's access token lasts two hours and is
// renewed silently on almost every call (lib/x/token.ts), so `expires_at` is
// stale by design and gating on it would refuse nearly every publish with
// "that connection has expired". Liveness on X is decided by what a refresh
// actually returns — see `xTokenFailure` below, which is where a dead
// connection becomes a refusal.
export interface XPublishableAccount {
  scope: string
}

// The gate. Two independent keys, checked in this order so the reason reported
// is the one the reader can act on first, and deliberately not collapsed into
// one boolean: a mistake that flips one key must not be enough on its own.
//
//   1. `PRESTO_ENABLE_LIVE_PUBLISH` — the user's own explicit act, unset by
//      default and absent from .env.local.example because it is not
//      configuration. Shared with LinkedIn: one switch, both platforms.
//   2. A connection made before tweet.write was requested (2026-09-04) carries
//      no such grant, so this returns "scope_not_granted" until the member
//      reconnects.
export function checkXPublishGate(
  account: XPublishableAccount
): { allowed: true } | { allowed: false; failure: PublishFailure } {
  if (!isLivePublishEnabled()) {
    return { allowed: false, failure: "publishing_disabled" }
  }

  if (!hasXPublishScope(account.scope)) {
    return { allowed: false, failure: "scope_not_granted" }
  }

  return { allowed: true }
}

// How a failure to *get* a token reads as a failure to publish.
//
// Exported because the runner asks lib/x/token.ts for the token (it owns the
// Supabase client) and has to turn the answer into the same vocabulary
// everything else speaks. Kept here rather than there so the mapping sits with
// the copy it drives.
export function xTokenFailure(
  failure: "not_connected" | "revoked" | "config" | "unavailable"
): PublishFailure {
  switch (failure) {
    case "not_connected":
      return "not_connected"
    // The connection is dead: the member revoked Presto at X's end, or the
    // refresh token lapsed. Reported as an expiry because the remedy is the
    // one the copy already names — reconnect it and try again.
    case "revoked":
      return "token_expired"
    // "config" is a missing X_CLIENT_ID/SECRET and "unavailable" is X having a
    // bad moment or a rotation that didn't land. Both are honestly described as
    // "we couldn't get a working connection", and neither is a verdict on the
    // post — which is why they are not reported as `publish`.
    case "config":
    case "unavailable":
      return "token_unavailable"
  }
}

interface TweetResponseBody {
  data?: { id?: string }
}

// The request itself. **Never reachable without passing `checkXPublishGate`
// first** — that is the caller's contract, and the gate is re-checked here so
// the two cannot be accidentally reordered. The only caller is
// lib/publish-runner.ts.
async function postTweet(
  accessToken: string,
  text: string
): Promise<XPublishResult> {
  let response: Response
  try {
    response = await fetch(TWEETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      cache: "no-store",
    })
  } catch (error) {
    return { ok: false, failure: isNetworkError(error) ? "network" : "publish" }
  }

  // Everything X refuses arrives here: an over-length post (the guard in
  // lib/post-length.ts should have caught it first), a duplicate of something
  // recently posted, an exhausted quota, a rate limit, a token the app no
  // longer holds the permission for. None of them mean anything was created.
  //
  // Two are singled out because they are **not verdicts on the post**, and
  // telling someone "X wouldn't accept this post, try again" about either is
  // wrong in a way that wastes their time:
  //
  //   402  the API account is out of credits. Permanent until someone pays;
  //        retrying is pure noise. Seen live on 2026-09-04 —
  //        `{"detail":"credits depleted","title":"Payment Required"}` — which
  //        is what this branch was written from.
  //   429  rate-limited. Retryable, but not now. Near-certain on the Free
  //        tier, whose budget is shared across every user of the app.
  if (!response.ok) {
    // Logged, because a server-side refusal is otherwise invisible: the code
    // reaching the user is deliberately coarse, and without the provider's own
    // problem document there is nothing to diagnose from. X's error bodies are
    // problem-JSON describing the app, not the member, so nothing here is
    // sensitive — and the token is never in scope.
    console.error(
      "[x/publish] X refused the tweet",
      response.status,
      (await response.text().catch(() => "<unreadable>")).slice(0, 500)
    )

    if (response.status === 402) {
      return { ok: false, failure: "quota_exhausted" }
    }
    if (response.status === 429) {
      return { ok: false, failure: "rate_limited" }
    }

    return { ok: false, failure: "publish" }
  }

  // The created post's id comes back in the body — `{ data: { id, text } }` —
  // where LinkedIn puts it in a header. Its absence does not mean the request
  // failed: the 2xx above already said it succeeded. It means we cannot name
  // what was just created, which is a different and worse thing.
  //
  // An unreadable body counts as absent for the same reason. The post exists
  // either way, so the safe reading of "I can't parse this" is "it went out and
  // I have no id", never "it didn't go out".
  const body = (await response
    .json()
    .catch(() => null)) as TweetResponseBody | null

  const postId = body?.data?.id
  if (!postId) return { ok: false, failure: "published_without_urn" }

  return { ok: true, postId }
}

// The one entry point. Gate, then — and only then — the request.
export async function publishTweet(input: {
  account: XPublishableAccount
  accessToken: string
  content: string
}): Promise<XPublishResult> {
  const gate = checkXPublishGate(input.account)
  if (!gate.allowed) return { ok: false, failure: gate.failure }

  return postTweet(input.accessToken, input.content)
}
