// What this app asks LinkedIn for, and how to read back what a stored
// connection was actually granted.
//
// **Pure and dependency-free on purpose.** The other two modules here are
// server-only at runtime — oauth.ts reads the client secret, publish.ts makes
// the share call — but the Connections page is a client component and needs to
// know whether a row's grant still covers what we now ask for. Importing
// either of those from a client component would pull them into the bundle,
// which is the trap lib/ai/model-constants.ts exists to avoid.

// The scope a share call needs, and the reason this list is not sign-in-only
// any more. Kept beside the list rather than in publish.ts so that the one
// place that decides what is requested is the one place that names it.
export const LINKEDIN_PUBLISH_SCOPE = "w_member_social"

// What this app requests.
//
// **`w_member_social` was added on 2026-09-02, explicitly green-lit**, after
// sitting deliberately absent for as long as publishing was unbuilt. Holding
// the permission is not the same as using it: the share path stays behind
// `checkPublishGate` (lib/linkedin/publish.ts), whose first key is
// `PRESTO_ENABLE_LIVE_PUBLISH` and is still unset. Requesting the scope is
// what makes a *later* publish possible without a second re-authorisation of
// every account; it is not what makes one happen. See AGENTS.md's hard
// publishing constraint, which is unchanged: calling a share endpoint, or
// wiring a scheduler to one, still needs asking first, every time.
//
// **Adding it cost every token already issued**, per LinkedIn's docs: "if you
// request a different scope than the previously granted scope, all the
// previous access tokens are invalidated". So every connection made before
// this date has to be re-authorised. `grantIsCurrent` below is what tells
// those rows apart, and the connected row asks them to reconnect rather than
// letting them fail later with an opaque 401.
export const LINKEDIN_SCOPES = [
  "openid",
  "profile",
  "email",
  LINKEDIN_PUBLISH_SCOPE,
] as const

// LinkedIn *returns* granted scopes comma-delimited ("email,openid,profile")
// even though they are *sent* space-delimited — confirmed on a live exchange,
// and noted in oauth.ts where the value is stored. Splitting on only one of
// the two would report a granted scope as missing, so both are handled and
// empties dropped.
export function parseGrantedScopes(raw: string): Set<string> {
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((scope) => scope.trim())
      .filter(Boolean)
  )
}

// Whether a stored **LinkedIn** grant still covers everything this app now
// requests of LinkedIn.
//
// The platform check is the caller's job and is not optional: these are
// LinkedIn's scope strings, so asking this of an X row compares
// `users.read tweet.read offline.access` against a list containing
// `w_member_social` and is false for every X account that will ever exist —
// a permanent "Reconnect" prompt for a permission X is never asked for, and
// which reconnecting cannot clear. See isGrantStale below, which is what call
// sites should use.
//
// False means the connection predates a scope being added: the token is not
// dead — it keeps working for whatever it *was* granted — but it can't do the
// new thing, and only re-running the authorization flow fixes that. Today that
// is every connection made before w_member_social was added. Note this is
// deliberately not "does it have w_member_social": asking the question against
// LINKEDIN_SCOPES means the UI needs no edit the next time the list changes,
// and no connection is ever prompted to grant something we don't request.
export function grantIsCurrent(raw: string): boolean {
  const granted = parseGrantedScopes(raw)
  return LINKEDIN_SCOPES.every((scope) => granted.has(scope))
}

// The question a connections row actually wants to ask, platform included.
//
// Non-LinkedIn platforms are never stale: LINKEDIN_SCOPES has nothing to say
// about them, and each platform's own scope list is granted in full or the
// connection would not exist. Adding a scope to another platform later means
// giving it the same treatment here rather than widening this one.
export function isGrantStale(platform: string, scope: string): boolean {
  return platform === "linkedin" && !grantIsCurrent(scope)
}
