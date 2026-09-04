// Reading an OAuth scope string, for whichever provider granted it.
//
// **Pure and dependency-free on purpose**, same as the two platform scope lists
// that build on it: the Connections page is a client component and needs to
// know whether a stored grant still covers what the app now asks for, and
// neither lib/linkedin/publish.ts nor lib/x/oauth.ts may be reachable from a
// client bundle (they read the client secret and make the share call). This
// file is the shared bottom of that stack — it imports nothing, so it cannot
// become unsafe.

// Providers do not agree on a delimiter, and one provider does not agree with
// itself. LinkedIn *returns* granted scopes comma-delimited ("email,openid")
// even though they are *sent* space-delimited; X returns them space-delimited.
// Splitting on only one of the two would report a granted scope as missing, so
// both are handled and empties dropped.
export function parseGrantedScopes(raw: string): Set<string> {
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((scope) => scope.trim())
      .filter(Boolean)
  )
}

// Whether a stored grant covers every scope in a list.
//
// Asked against the app's whole request list rather than one scope, so the UI
// needs no edit the next time a list changes — and so no connection is ever
// prompted to grant something the app doesn't ask for. A grant carrying *more*
// than the list still passes: extra scopes are not this question's business.
export function grantCovers(
  raw: string,
  required: readonly string[]
): boolean {
  const granted = parseGrantedScopes(raw)
  return required.every((scope) => granted.has(scope))
}
