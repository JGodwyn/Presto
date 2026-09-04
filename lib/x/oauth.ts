import { createHash, randomBytes } from "crypto"

import { isNetworkError } from "@/lib/network-error"
import { X_SCOPES } from "@/lib/x/scopes"

// X's OAuth 2.0 endpoints and the slice of the protocol this app speaks.
// Server-only at runtime: the client secret is read here, so nothing in this
// file may be *called* from a client component. XFailure is imported by one
// (the Connections panel maps codes to copy) — a type-only import is erased at
// compile time and pulls no code into the bundle.
//
// Deliberately a sibling of lib/linkedin/oauth.ts rather than a shared
// abstraction over it. The two protocols agree on the shape of an authorization
// code flow and on almost nothing else: X mandates PKCE, issues 2-hour access
// tokens with rotating single-use refresh tokens, identifies members by handle
// rather than email, and authenticates the token endpoint with HTTP Basic. A
// premature merge of the two would be mostly branches.
//
// The scope list lives in lib/x/scopes.ts — pure, so the Connections page can
// read it without dragging the client secret and the token calls below into
// the browser bundle. Re-exported here because this is where a reader of the
// authorization request looks for it. It is **read-only**: `tweet.write` was
// added on 2026-09-04 under an explicit green-light and taken back out the same
// day, once X answered the first real send with `402 credits depleted`. See
// that file for what turning it on would cost.
export { X_SCOPES }

const AUTHORIZATION_URL = "https://x.com/i/oauth2/authorize"
const TOKEN_URL = "https://api.x.com/2/oauth2/token"
const REVOKE_URL = "https://api.x.com/2/oauth2/revoke"
// The one read this app ever spends on X. See getXProfile's comment: the Free
// tier's monthly read budget is shared across every user of the app, so the
// profile is fetched once at connect time and never refreshed.
const USERS_ME_URL =
  "https://api.x.com/2/users/me?user.fields=profile_image_url,username"

export const X_CALLBACK_PATH = "/api/connections/x/callback"

// The CSRF-and-PKCE cookie both legs of the flow share. It lives here rather
// than in either route file because Next type-checks route.ts exports and
// rejects anything that isn't a handler — a shared constant can't live in one.
export const OAUTH_STATE_COOKIE = "presto_x_oauth"
// Long enough to read a consent screen, short enough that an abandoned attempt
// doesn't leave a usable verifier lying around.
export const OAUTH_STATE_TTL_SECONDS = 600

// Every failure this flow can end in, as a short code carried back to the
// Connections page in a query param. The page maps them to copy — the codes
// never reach the user, and nothing from X's own error response is echoed into
// the URL.
export type XFailure =
  | "config"
  | "session"
  | "project"
  | "state"
  | "denied"
  | "exchange"
  | "profile"
  | "save"
  | "network"

export interface XCredentials {
  clientId: string
  clientSecret: string
}

export interface XConfig extends XCredentials {
  redirectUri: string
}

export function getXCredentials(): XCredentials | null {
  const clientId = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  return { clientId, clientSecret }
}

// The redirect URI must match one registered on the X app *exactly*, so it is
// derived from the request's own origin by default (which keeps localhost,
// previews and production working with no per-environment config) and can be
// pinned with X_REDIRECT_URI when the app sits behind a proxy whose origin
// isn't the public one.
//
// Unlike LinkedIn — whose app has only :3000 registered, so its connect leg
// can't be exercised from a worktree (LEARNINGS.md) — the X app registers both
// :3000 and this repo's worktree ports, so connecting works wherever the dev
// server happens to be.
//
// **Locally that means 127.0.0.1, not localhost.** X's console rejects the
// `localhost` hostname when registering a callback, so the loopback IP is the
// registered form and the dev app has to be browsed at it for this derivation
// to produce a match. Pinning X_REDIRECT_URI instead does not work: the two
// spellings are different cookie origins, so a flow started on localhost would
// not send its state cookie to a 127.0.0.1 callback.
// Loopback hosts, with an optional port. Only these may override the origin —
// see resolveRequestOrigin.
const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/

/**
 * The origin the browser actually used, which is not always what Next reports.
 *
 * `request.nextUrl.origin` is pinned to `http://localhost:<port>` in
 * development no matter which host was requested — verified in-browser: a
 * request to 127.0.0.1:3003 reports `host: "127.0.0.1:3003"` and
 * `nextUrl.origin: "http://localhost:3003"`. That is fatal here specifically,
 * because X's console rejects the hostname `localhost` when registering a
 * callback, so 127.0.0.1 is the *only* form that can be registered — and a
 * redirect_uri must match a registered value byte for byte. Deriving it from
 * nextUrl would send `localhost` and X would reject every attempt.
 *
 * **The Host header is client-controlled, so it is trusted only when it names a
 * loopback address.** Building a redirect off an arbitrary attacker-supplied
 * Host is an open-redirect vector; restricting the override to loopback means a
 * forged header can only ever point the victim back at their own machine, which
 * buys an attacker nothing. Everywhere else nextUrl.origin stands, and
 * X_REDIRECT_URI remains the escape hatch for a proxy that needs a third answer.
 */
export function resolveRequestOrigin(
  nextUrlOrigin: string,
  hostHeader: string | null
): string {
  if (hostHeader && LOOPBACK_HOST.test(hostHeader)) {
    return `http://${hostHeader}`
  }
  return nextUrlOrigin
}

export function getXConfig(origin: string): XConfig | null {
  const credentials = getXCredentials()
  if (!credentials) return null

  return {
    ...credentials,
    redirectUri: process.env.X_REDIRECT_URI ?? `${origin}${X_CALLBACK_PATH}`,
  }
}

// PKCE. X only supports authorization-code-with-PKCE, so this is mandatory
// rather than defence in depth: the verifier is a random secret kept by us, the
// challenge its SHA-256 sent to X up front, and the token exchange proves we
// are the same party that started the flow by presenting the verifier.
//
// base64url throughout, per RFC 7636 — the verifier must be 43-128 characters
// from an unreserved set, and 32 random bytes encodes to 43.
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  return { verifier, challenge }
}

export function buildAuthorizationUrl(
  config: XConfig,
  state: string,
  challenge: string
): string {
  const url = new URL(AUTHORIZATION_URL)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("state", state)
  url.searchParams.set("scope", X_SCOPES.join(" "))
  url.searchParams.set("code_challenge", challenge)
  url.searchParams.set("code_challenge_method", "S256")
  return url.toString()
}

export interface XToken {
  accessToken: string
  // Two hours, per X's docs, derived from the response rather than hardcoded so
  // a change on their side carries through on its own.
  expiresAt: Date
  // **The connection itself**, and the reason X needs machinery LinkedIn does
  // not. Present whenever `offline.access` was granted. Rotating and
  // single-use: spending it returns a replacement and invalidates this one, so
  // whatever persists it must land the replacement before using the access
  // token that came with it.
  refreshToken: string | null
  // Roughly six months from issue. X does not report this in the token
  // response, so it is computed — see REFRESH_TOKEN_TTL_MS.
  refreshExpiresAt: Date | null
  scope: string
}

// X does not tell us when a refresh token dies; its docs say six months. Held
// as a constant so the one place that guesses is named and greppable, and so
// the UI can show a connection's real horizon rather than a 2-hour one.
//
// It is a *display* value and nothing branches on it: liveness is decided by
// what a refresh actually returns, never by comparing this to the clock. If X
// changes the lifetime, a stale number here misleads a user by a few weeks; it
// cannot disconnect anyone.
export const REFRESH_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000

export interface XProfile {
  // X's numeric user id as a string — stable across handle changes, which is
  // exactly why the handle is not used as the identity.
  id: string
  name: string
  handle: string
  avatarUrl: string | null
}

type XResult<T> = { ok: true; value: T } | { ok: false; failure: XFailure }

// X accepts client credentials either in the body or as an Authorization
// header, and is documented as requiring the header for confidential clients.
// Presto registers as a confidential client (Web App), so it goes in the
// header — and keeping the secret out of the body means it stays out of any
// request log that captures form bodies.
function basicAuth(credentials: XCredentials): string {
  const raw = `${credentials.clientId}:${credentials.clientSecret}`
  return `Basic ${Buffer.from(raw).toString("base64")}`
}

interface TokenResponseBody {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}

// What the token endpoint did, kept separate from how a caller reports it: the
// initial exchange and a refresh care about different distinctions. A failed
// exchange is just a failed connect attempt. A failed refresh has to decide
// something heavier — whether the connection is dead and should be marked
// revoked, or whether X merely had a bad moment and the row should be left
// alone to try again.
type TokenAttempt =
  | { ok: true; value: XToken }
  | { ok: false; status: number | null; network: boolean }

// The two token-endpoint calls (initial exchange and refresh) differ only in
// their form body, so the request and the response mapping are shared —
// including the detail that a refresh returns a *new* refresh token which must
// replace the one spent.
async function postToken(
  credentials: XCredentials,
  body: Record<string, string>,
  now: number
): Promise<TokenAttempt> {
  let response: Response
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuth(credentials),
      },
      body: new URLSearchParams(body),
      cache: "no-store",
    })
  } catch (error) {
    return { ok: false, status: null, network: isNetworkError(error) }
  }

  if (!response.ok) {
    return { ok: false, status: response.status, network: false }
  }

  const parsed = (await response
    .json()
    .catch(() => null)) as TokenResponseBody | null

  if (!parsed?.access_token || !parsed.expires_in) {
    // A 200 we can't read is not a verdict on the credentials, so it is
    // reported as an unusable response rather than a rejected grant.
    return { ok: false, status: null, network: false }
  }

  const refreshToken = parsed.refresh_token ?? null

  return {
    ok: true,
    value: {
      accessToken: parsed.access_token,
      expiresAt: new Date(now + parsed.expires_in * 1000),
      refreshToken,
      // Only meaningful alongside a refresh token, and deliberately restamped
      // on every rotation: X issues a fresh six months with each new refresh
      // token, so an active connection never approaches this date.
      refreshExpiresAt: refreshToken
        ? new Date(now + REFRESH_TOKEN_TTL_MS)
        : null,
      // Stored verbatim. X returns scopes space-delimited here (unlike
      // LinkedIn, which sends spaces and returns commas), but nothing branches
      // on this column — anything that eventually does should split on both.
      scope: parsed.scope ?? X_SCOPES.join(" "),
    },
  }
}

export async function exchangeCodeForToken(
  config: XConfig,
  code: string,
  verifier: string,
  now: number = Date.now()
): Promise<XResult<XToken>> {
  const attempt = await postToken(
    config,
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
      // Sent despite the Basic header: X's docs include it in the body for
      // this grant, and a duplicate that agrees with the header is harmless.
      client_id: config.clientId,
    },
    now
  )

  if (attempt.ok) return { ok: true, value: attempt.value }

  return { ok: false, failure: attempt.network ? "network" : "exchange" }
}

// A refresh either produces a live token, proves the connection is dead, or
// tells us nothing. The third case is not the second: see below.
export type XRefreshOutcome =
  | { ok: true; value: XToken }
  | { ok: false; reason: "revoked" }
  | { ok: false; reason: "unavailable" }

// Spend a refresh token for a new access token — and a new refresh token.
//
// **The returned refresh token replaces the one passed in, which is now dead.**
// Callers must persist the replacement before using the access token beside it;
// lose it and the connection is unrecoverable without the member reconnecting.
// lib/x/token.ts is the only intended caller and does exactly that.
//
// **Fails open**, in the same spirit as lib/linkedin/oauth.ts's
// verifyLinkedInToken: only a 4xx — the OAuth-specified answer for a grant that
// is no longer valid, which is what revocation and expiry both look like — is
// read as revoked. A 429, a 5xx or a dropped connection all mean "couldn't
// tell", and killing a working connection on a flaky lookup is worse than
// noticing a dead one late.
//
// The decision is made on the *status*, deliberately not on the error string in
// the body: X answers a spent refresh token with `invalid_request` and the
// description "Value passed for the token was invalid" rather than the
// `invalid_grant` the spec would suggest, so matching on that text would be
// both wrong today and fragile tomorrow.
export async function refreshAccessToken(
  credentials: XCredentials,
  refreshToken: string,
  now: number = Date.now()
): Promise<XRefreshOutcome> {
  const attempt = await postToken(
    credentials,
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: credentials.clientId,
    },
    now
  )

  if (attempt.ok) return { ok: true, value: attempt.value }

  // Exactly the two statuses that are a verdict on the grant itself. A wider
  // "any 4xx" reads 429 as revocation and would disconnect a member for being
  // rate-limited — which, on a Free tier whose budget is shared across every
  // user of the app, is a thing that will happen.
  const definitelyRejected = attempt.status === 400 || attempt.status === 401

  return { ok: false, reason: definitelyRejected ? "revoked" : "unavailable" }
}

export async function fetchXProfile(
  accessToken: string
): Promise<XResult<XProfile>> {
  // **This is the only read this app spends on X, per connection, ever.**
  // The Free tier's ~100 reads/month is a single pool shared by every user of
  // the app, not a per-user budget, so a polled profile refresh or a
  // liveness probe of the kind lib/linkedin/liveness.ts runs hourly would
  // consume the whole app's monthly allowance on one account. The profile is
  // therefore stored at connect time and never re-read: a member who changes
  // their display name shows the old one until they reconnect. Revocation is
  // detected from a failed refresh instead, which costs no reads at all.
  //
  // Do not add a call here without re-checking that budget.
  let response: Response
  try {
    response = await fetch(USERS_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
  } catch (error) {
    return { ok: false, failure: isNetworkError(error) ? "network" : "profile" }
  }

  if (!response.ok) return { ok: false, failure: "profile" }

  const body = (await response.json().catch(() => null)) as {
    data?: { id?: string; name?: string; username?: string; profile_image_url?: string }
  } | null

  const data = body?.data
  if (!data?.id || !data.username) return { ok: false, failure: "profile" }

  return {
    ok: true,
    value: {
      id: data.id,
      // A nameless account is still a real, usable connection and shouldn't
      // fail the whole flow — fall back to the handle, which is always present.
      name: data.name || `@${data.username}`,
      handle: data.username,
      avatarUrl: data.profile_image_url ?? null,
    },
  }
}

// Best-effort: disconnecting has already removed the row by the time this runs,
// and a token this app has thrown away is harmless whether or not X accepts the
// revocation. Never throws — the caller doesn't branch on it.
//
// The refresh token is the one worth revoking: killing it ends the connection,
// while the access token beside it expires within two hours regardless.
export async function revokeXToken(
  credentials: XCredentials,
  token: string
): Promise<void> {
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuth(credentials),
      },
      body: new URLSearchParams({
        token,
        token_type_hint: "refresh_token",
        client_id: credentials.clientId,
      }),
      cache: "no-store",
    })
  } catch {
    // Deliberately swallowed — see above.
  }
}
