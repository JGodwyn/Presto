// What this app asks X for, and how to read back what a stored connection was
// actually granted.
//
// **Pure and dependency-free on purpose, and split out of lib/x/oauth.ts for
// exactly that reason.** oauth.ts reads the client secret, so a client
// component may not import it — but the Connections page has to know whether a
// stored X grant predates a scope the app has since started asking for. This is
// the same split lib/linkedin/scopes.ts has from lib/linkedin/publish.ts, and
// the same trap lib/ai/model-constants.ts exists to avoid.

import { grantCovers, parseGrantedScopes } from "@/lib/scope-grant"

// The scope a `POST /2/tweets` call would need. Named here — beside the list
// that decides what is asked for — even though it is **deliberately not in that
// list**, because `checkXPublishGate` (lib/x/publish.ts) tests for it and the
// two belong together.
export const X_PUBLISH_SCOPE = "tweet.write"

// What this app requests. Read-only: `tweet.write` is deliberately absent, and
// scopes.test.ts pins that so the guarantee survives a careless edit.
//
// **It was added on 2026-09-04 under an explicit green-light, and removed the
// same day.** The publishing path itself works — lib/x/publish.ts is complete
// and was exercised against the live API — but X answered the first real send
// with `402 credits depleted`: posting through the v2 API costs money, and the
// quota is metered **per app, across every user of Presto**, not per account.
// The owner's decision was not to pay for that, so X publishing is coming soon
// rather than shipped, and asking members to grant posting permission the app
// will not use would be asking for something under false pretences.
//
// **This is one of two locks and the other is not in this repo.** X caps what
// any scope request can be granted at the *app* level ("App permissions" in
// X's console); that should be back on `Read`. Either lock alone is enough.
//
// **Turning it back on is: this list, `PUBLISHABLE_PLATFORMS`
// (lib/post-publish.ts), the X app's permission, and a reconnect** — a scope
// change invalidates every token already issued, on X exactly as on LinkedIn.
// `xGrantIsCurrent` below is what tells stale rows apart, and note it passes a
// grant carrying *more* than is requested, so the connection made while
// tweet.write was briefly asked for is not stuck reading as stale.
export const X_SCOPES = [
  "users.read",
  "tweet.read",
  // Without this the connection dies in two hours — X's access tokens are
  // short-lived and only a refresh token keeps one alive. Listed last because
  // it is the one scope that is about the connection rather than the account.
  "offline.access",
] as const

// Whether a stored X grant still covers everything this app now requests of X.
// False means the connection predates a scope being added: the token is not
// dead — it keeps working for whatever it *was* granted — but it can't do the
// new thing, and only re-running the authorization flow fixes that.
export function xGrantIsCurrent(raw: string): boolean {
  return grantCovers(raw, X_SCOPES)
}

// The narrower question the share call itself asks, one scope rather than the
// whole list: this is what decides whether a request would be rejected, and it
// must not fail because some unrelated scope was added to X_SCOPES afterwards.
//
// False for every connection the app can currently make, since `tweet.write`
// is not requested — which is exactly what keeps the publish gate shut.
export function hasXPublishScope(raw: string): boolean {
  return parseGrantedScopes(raw).has(X_PUBLISH_SCOPE)
}
