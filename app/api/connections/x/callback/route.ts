import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

import { encryptApiKey } from "@/lib/ai/key-crypto"
import {
  exchangeCodeForToken,
  fetchXProfile,
  getXConfig,
  OAUTH_STATE_COOKIE,
  resolveRequestOrigin,
  type XFailure,
} from "@/lib/x/oauth"
import { createClient } from "@/lib/supabase/server"

// Step two: X sends the member back here with an authorization code. Exchange
// it (presenting the PKCE verifier), read the profile the token unlocks, store
// both, and return to the Connections page — which renders the connected row
// from the database rather than from anything in this URL.
//
// Nothing here publishes, and nothing here can: the token is minted with
// read-only scopes and the X app's own permissions are set to Read, so
// AGENTS.md's hard publishing constraint holds twice over.

// The origin this request really came in on. Every URL this route builds — the
// redirect_uri handed to X and the redirects back into the app — must use the
// same one, or the OAuth state cookie gets set on one origin and read on
// another and the flow dies at the state check.
function originOf(request: NextRequest): string {
  return resolveRequestOrigin(
    request.nextUrl.origin,
    request.headers.get("host")
  )
}

function backToConnections(
  request: NextRequest,
  projectId: string | null,
  result: { failure: XFailure } | { connected: true }
) {
  const path = projectId ? `/projects/${projectId}/connections` : "/projects"
  const url = new URL(path, originOf(request))
  if ("failure" in result) {
    url.searchParams.set("connect_error", result.failure)
    // Which provider failed, so the toast names X rather than LinkedIn.
    // LinkedIn's own routes don't set this; its absence reads as LinkedIn.
    url.searchParams.set("connect_error_platform", "x")
  } else {
    url.searchParams.set("connected", "x")
  }
  return NextResponse.redirect(url)
}

function readStateCookie(raw: string | undefined) {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { state?: unknown }).state === "string" &&
      typeof (parsed as { projectId?: unknown }).projectId === "string" &&
      typeof (parsed as { verifier?: unknown }).verifier === "string"
    ) {
      return parsed as { state: string; projectId: string; verifier: string }
    }
  } catch {
    // A malformed cookie is treated exactly like a missing one.
  }
  return null
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const stored = readStateCookie(cookieStore.get(OAUTH_STATE_COOKIE)?.value)
  // One attempt per cookie, whatever happens next — a state (and a verifier)
  // that has been presented once must not be reusable.
  cookieStore.delete(OAUTH_STATE_COOKIE)

  const projectId = stored?.projectId ?? null
  const params = request.nextUrl.searchParams

  // The member pressed Cancel on X's consent screen. Not an error to apologise
  // for — the page just returns to how it was.
  if (params.get("error")) {
    return backToConnections(request, projectId, { failure: "denied" })
  }

  const code = params.get("code")
  const state = params.get("state")
  if (!stored || !code || !state || state !== stored.state) {
    // Also where a localhost/127.0.0.1 origin mismatch lands: the cookie was
    // set on the other spelling and never arrived. See LEARNINGS.md.
    return backToConnections(request, projectId, { failure: "state" })
  }

  const config = getXConfig(originOf(request))
  if (!config) {
    return backToConnections(request, projectId, { failure: "config" })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return backToConnections(request, projectId, { failure: "session" })
  }

  const token = await exchangeCodeForToken(config, code, stored.verifier)
  if (!token.ok) {
    return backToConnections(request, projectId, { failure: token.failure })
  }

  // The one read this connection ever spends against X's shared monthly budget
  // — see fetchXProfile. Everything the UI shows is captured here and never
  // re-fetched.
  const profile = await fetchXProfile(token.value.accessToken)
  if (!profile.ok) {
    return backToConnections(request, projectId, { failure: profile.failure })
  }

  // Upsert, not insert: reconnecting the same platform on the same project
  // replaces the stale token in place rather than stacking a second row (the
  // (project_id, platform) unique constraint is what this targets). The
  // ownership check is RLS's — the insert policy requires the project to be
  // this user's, so a forged project id in the cookie writes nothing.
  const { error } = await supabase.from("social_accounts").upsert(
    {
      project_id: stored.projectId,
      user_id: user.id,
      platform: "x",
      provider_account_id: profile.value.id,
      account_name: profile.value.name,
      account_handle: profile.value.handle,
      // X does not return an email without a permission this app doesn't hold.
      account_email: null,
      avatar_url: profile.value.avatarUrl,
      // Same AES-256-GCM envelope and key as users' provider API keys — the
      // function is named for that first use, but the property it provides
      // (a leaked row is useless without MODEL_KEY_ENCRYPTION_KEY) is exactly
      // what an access token needs too.
      encrypted_access_token: encryptApiKey(token.value.accessToken),
      // The one that actually matters on X: the access token beside it dies in
      // two hours, and this is what renews it. Null only if offline.access was
      // somehow not granted, which lib/x/token.ts reports as unrenewable.
      encrypted_refresh_token: token.value.refreshToken
        ? encryptApiKey(token.value.refreshToken)
        : null,
      scope: token.value.scope,
      expires_at: token.value.expiresAt.toISOString(),
      refresh_expires_at: token.value.refreshExpiresAt?.toISOString() ?? null,
      connected_at: new Date().toISOString(),
      // Reset explicitly, and this matters: an upsert only writes the columns
      // it names, so reconnecting an account that had been marked `revoked`
      // would otherwise keep that status against a brand-new working token —
      // the row would read dead forever. The token was just minted and the
      // profile call above it succeeded, so it is alive by construction.
      status: "active",
      last_checked_at: new Date().toISOString(),
      // Likewise: a connection abandoned mid-refresh must not carry a stale
      // claim into its new life, or the first refresh waits out the timeout.
      refresh_started_at: null,
    },
    { onConflict: "project_id,platform" }
  )

  if (error) {
    return backToConnections(request, projectId, { failure: "save" })
  }

  return backToConnections(request, stored.projectId, { connected: true })
}
