import { LINKEDIN_SCOPES } from "@/lib/linkedin/scopes"
import { isNetworkError } from "@/lib/network-error"

// LinkedIn's OAuth 2.0 / OpenID Connect endpoints and the small amount of
// protocol this app actually speaks. Server-only at runtime: the client secret
// is read here, so nothing in this file may be *called* from a client
// component. The LinkedInFailure type is imported by one (the Connections
// panel maps the codes to copy) — a type-only import is erased at compile
// time and pulls no code into the bundle.
//
// Scopes live in scopes.ts, not here: the Connections page needs to read them
// and this file must never reach a client bundle.

const AUTHORIZATION_URL = "https://www.linkedin.com/oauth/v2/authorization"
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
const REVOKE_URL = "https://www.linkedin.com/oauth/v2/revoke"
// Note the different host: authorization lives on www.linkedin.com, the API
// (userinfo included) on api.linkedin.com.
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo"

export const LINKEDIN_CALLBACK_PATH = "/api/connections/linkedin/callback"

// The CSRF state cookie both legs of the flow share. It lives here rather than
// in either route file because Next type-checks route.ts exports and rejects
// anything that isn't a handler — a shared constant can't live in one.
export const OAUTH_STATE_COOKIE = "presto_linkedin_oauth"
// Long enough to read a consent screen, short enough that an abandoned attempt
// doesn't leave a usable state lying around.
export const OAUTH_STATE_TTL_SECONDS = 600

// Every failure this flow can end in, as a short code carried back to the
// Connections page in a query param. The page maps them to copy — the codes
// themselves never reach the user, and nothing from LinkedIn's own error
// response is echoed into the URL.
export type LinkedInFailure =
  | "config"
  | "session"
  | "project"
  | "state"
  | "denied"
  | "exchange"
  | "profile"
  | "save"
  | "network"

// The app's own identity with LinkedIn. Enough on its own for the calls that
// don't involve a browser round trip (revocation); the authorize/callback pair
// needs the redirect URI on top of it.
export interface LinkedInCredentials {
  clientId: string
  clientSecret: string
}

export interface LinkedInConfig extends LinkedInCredentials {
  redirectUri: string
}

export function getLinkedInCredentials(): LinkedInCredentials | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  return { clientId, clientSecret }
}

// The redirect URI has to match what's registered on the LinkedIn app
// *exactly*, so it's derived from the request's own origin by default (which
// keeps localhost, previews and production all working with no per-environment
// config) and can be pinned with LINKEDIN_REDIRECT_URI when the app sits
// behind a proxy whose origin isn't the public one.
export function getLinkedInConfig(origin: string): LinkedInConfig | null {
  const credentials = getLinkedInCredentials()
  if (!credentials) return null

  return {
    ...credentials,
    redirectUri:
      process.env.LINKEDIN_REDIRECT_URI ?? `${origin}${LINKEDIN_CALLBACK_PATH}`,
  }
}

export function buildAuthorizationUrl(
  config: LinkedInConfig,
  state: string
): string {
  const url = new URL(AUTHORIZATION_URL)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("state", state)
  url.searchParams.set("scope", LINKEDIN_SCOPES.join(" "))
  return url.toString()
}

export interface LinkedInToken {
  accessToken: string
  // Confirmed against LinkedIn's own docs: "all access tokens are issued with
  // a 60-day lifespan", `expires_in` in seconds (5184000). Derived from the
  // response rather than hardcoded anyway, so a change on their side carries
  // through on its own.
  //
  // **There is no refresh token to store.** Programmatic refresh tokens are
  // limited to approved Marketing Developer Platform partners; a standard app
  // renews by re-running the authorization flow. That's why the connected row
  // surfaces an expiry at all — and it's why re-connecting *before* day 60 is
  // worth prompting: LinkedIn skips the consent screen entirely if the member
  // is still signed in **and the current token hasn't expired yet**. Let it
  // lapse and they get the full authorization screen again.
  expiresAt: Date
  scope: string
}

export interface LinkedInProfile {
  // The OIDC `sub` claim — stable per (member, app), and the only id worth
  // storing: the name and picture can both change under it.
  id: string
  name: string
  email: string | null
  pictureUrl: string | null
}

type LinkedInResult<T> = { ok: true; value: T } | { ok: false; failure: LinkedInFailure }

// A rejected fetch here is a connectivity problem on *our* side reaching
// LinkedIn, not the user's browser being offline — it's reported as its own
// failure so the page can say so rather than blaming the credentials.
function failureFor(error: unknown): LinkedInFailure {
  return isNetworkError(error) ? "network" : "exchange"
}

export async function exchangeCodeForToken(
  config: LinkedInConfig,
  code: string
): Promise<LinkedInResult<LinkedInToken>> {
  let response: Response
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
    })
  } catch (error) {
    return { ok: false, failure: failureFor(error) }
  }

  if (!response.ok) return { ok: false, failure: "exchange" }

  const body = (await response.json().catch(() => null)) as {
    access_token?: string
    expires_in?: number
    scope?: string
  } | null

  if (!body?.access_token || !body.expires_in) {
    return { ok: false, failure: "exchange" }
  }

  return {
    ok: true,
    value: {
      accessToken: body.access_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
      // Stored verbatim, and note the format flips: we *send* scopes
      // space-delimited, LinkedIn returns them **comma**-delimited
      // ("email,openid,profile" on a live exchange). Nothing reads this column
      // yet, but whatever eventually checks whether a scope was granted must
      // split on both — assuming spaces would silently report "not granted".
      scope: body.scope ?? LINKEDIN_SCOPES.join(" "),
    },
  }
}

export async function fetchLinkedInProfile(
  accessToken: string
): Promise<LinkedInResult<LinkedInProfile>> {
  let response: Response
  try {
    response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
  } catch (error) {
    return {
      ok: false,
      failure: isNetworkError(error) ? "network" : "profile",
    }
  }

  if (!response.ok) return { ok: false, failure: "profile" }

  const body = (await response.json().catch(() => null)) as {
    sub?: string
    name?: string
    given_name?: string
    family_name?: string
    email?: string
    picture?: string
  } | null

  if (!body?.sub) return { ok: false, failure: "profile" }

  // `name` is the claim the connected row wants ("Connected as Godwin John").
  // It's only returned when the member's profile carries a display name in the
  // requested locale, so the given/family pair is the fallback before giving
  // up and saying "LinkedIn account" — a nameless row is still a real, usable
  // connection and shouldn't fail the whole flow.
  const name =
    body.name ??
    [body.given_name, body.family_name].filter(Boolean).join(" ").trim()

  return {
    ok: true,
    value: {
      id: body.sub,
      name: name || "LinkedIn account",
      email: body.email ?? null,
      pictureUrl: body.picture ?? null,
    },
  }
}

// Best-effort: disconnecting has already removed the row by the time this
// runs, and a token we've thrown away is harmless whether or not LinkedIn
// accepts the revocation. Never throws — the caller doesn't branch on it.
export async function revokeLinkedInToken(
  credentials: LinkedInCredentials,
  accessToken: string
): Promise<void> {
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        token: accessToken,
      }),
      cache: "no-store",
    })
  } catch {
    // Deliberately swallowed — see above.
  }
}

// Whether the stored token is still good, asked of LinkedIn directly.
//
// A connection can die well before its 60-day expiry: the member can revoke
// Presto's access from LinkedIn's own settings, and nothing tells us. The only
// way to find out is to use the token, so this makes the cheapest call that
// needs one — the same `/v2/userinfo` the connect flow already reads, which
// needs nothing beyond the sign-in scopes every connection already has.
//
// **Fails open, deliberately**, in the same spirit as didFallBackOffByok
// (lib/ai/generate.ts): only an explicit 401 is treated as revoked. A 429, a
// 5xx or a dropped connection all mean "couldn't tell", and marking a working
// connection dead on a flaky lookup is worse than missing a revoked one — the
// next check gets another go, and expiry still catches the row eventually.
export type TokenLiveness = "alive" | "revoked" | "unknown"

export async function verifyLinkedInToken(
  accessToken: string
): Promise<TokenLiveness> {
  let response: Response
  try {
    response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
  } catch {
    return "unknown"
  }

  if (response.ok) return "alive"
  // 401 is the revoked/invalid-token answer. 403 is *not* included: that's a
  // permissions answer about the call, not a verdict on the token itself, and
  // reading it as revocation would kill a connection over a scope problem.
  if (response.status === 401) return "revoked"
  return "unknown"
}
