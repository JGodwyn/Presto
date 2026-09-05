import { grantIsCurrent } from "@/lib/linkedin/scopes"
import { xGrantIsCurrent } from "@/lib/x/scopes"

// The question a connections row actually wants to ask, platform included.
//
// **Pure**, and the reason it is here rather than in either platform's own
// scope file: those files answer their own platform's question, and the answer
// is meaningless applied to the other. `grantIsCurrent` compares against
// LinkedIn's scope strings, so asking it of an X row is false for every X
// account that will ever exist — a permanent "Reconnect to grant Presto
// permission to post" chip for a permission X is never asked for, and which
// reconnecting could not clear. That bug shipped once, which is why the
// platform switch is a single named function with a test on it rather than an
// `=== "linkedin"` at each call site.
//
// A platform with no entry here is never stale: this file has nothing to say
// about it, and its own scope list is granted in full or the connection would
// not exist. Adding a platform later means adding it here, not widening one of
// the two branches.
export function isGrantStale(platform: string, scope: string): boolean {
  switch (platform) {
    case "linkedin":
      return !grantIsCurrent(scope)
    case "x":
      // True for every X connection made before tweet.write was requested
      // (2026-09-04). Those tokens are almost certainly dead anyway — X
      // invalidates existing tokens when an app's permissions change — but a
      // dead connection reads as "Connection revoked" only once something has
      // tried to use it, and this says so on sight.
      return !xGrantIsCurrent(scope)
    default:
      return false
  }
}
