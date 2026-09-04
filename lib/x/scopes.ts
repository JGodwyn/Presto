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

// The scope a `POST /2/tweets` call needs, and the reason this list is no
// longer sign-in-only. Kept beside the list that requests it so the one place
// that decides what is asked for is the one place that names it.
export const X_PUBLISH_SCOPE = "tweet.write"

// What this app requests.
//
// **`tweet.write` was added on 2026-09-04, explicitly green-lit**, after
// sitting deliberately absent for as long as publishing was unbuilt. Holding
// the permission is not the same as using it: the share path stays behind
// `checkXPublishGate` (lib/x/publish.ts), whose first key is
// `PRESTO_ENABLE_LIVE_PUBLISH` and is unset by default. See AGENTS.md's hard
// publishing constraint, which is unchanged: calling a share endpoint, or
// wiring a scheduler to one, still needs asking first, every time.
//
// **This is one of two locks and the other is not in this repo.** X caps what
// any scope request can be granted at the *app* level ("App permissions" in
// X's console), so this list is only effective once that is set to
// Read-and-write. It was, on 2026-09-04.
//
// **Flipping it cost every token already issued** — X invalidates existing
// tokens when an app's permissions change, exactly as LinkedIn does when the
// requested scope set changes. So every connection made before that date has
// to be re-authorised; `xGrantIsCurrent` below is what tells those rows apart,
// and the connected row asks them to reconnect rather than letting them fail
// later with an opaque 401.
export const X_SCOPES = [
  "users.read",
  "tweet.read",
  X_PUBLISH_SCOPE,
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
export function hasXPublishScope(raw: string): boolean {
  return parseGrantedScopes(raw).has(X_PUBLISH_SCOPE)
}
