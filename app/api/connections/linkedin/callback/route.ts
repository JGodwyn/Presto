import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

import { encryptApiKey } from "@/lib/ai/key-crypto"
import {
  exchangeCodeForToken,
  fetchLinkedInProfile,
  getLinkedInConfig,
  OAUTH_STATE_COOKIE,
  type LinkedInFailure,
} from "@/lib/linkedin/oauth"
import { createClient } from "@/lib/supabase/server"

// Step two: LinkedIn sends the member back here with an authorization code.
// Exchange it for a token, read the profile the token unlocks, store both, and
// return to the Connections page — which then renders the connected row from
// the database rather than from anything in this URL.
//
// Nothing here publishes, and nothing here can: the token is minted with
// sign-in scopes only (see lib/linkedin/oauth.ts) and AGENTS.md's hard
// publishing constraint holds regardless.

function backToConnections(
  request: NextRequest,
  projectId: string | null,
  result: { failure: LinkedInFailure } | { connected: true }
) {
  const path = projectId ? `/projects/${projectId}/connections` : "/projects"
  const url = new URL(path, request.nextUrl.origin)
  if ("failure" in result) {
    url.searchParams.set("connect_error", result.failure)
  } else {
    url.searchParams.set("connected", "linkedin")
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
      typeof (parsed as { projectId?: unknown }).projectId === "string"
    ) {
      return parsed as { state: string; projectId: string }
    }
  } catch {
    // A malformed cookie is treated exactly like a missing one.
  }
  return null
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const stored = readStateCookie(cookieStore.get(OAUTH_STATE_COOKIE)?.value)
  // One attempt per cookie, whatever happens next — a state that has been
  // presented once must not be reusable.
  cookieStore.delete(OAUTH_STATE_COOKIE)

  const projectId = stored?.projectId ?? null
  const params = request.nextUrl.searchParams

  // The member pressed Cancel on LinkedIn's consent screen. Not an error to
  // apologise for — the page just returns to how it was.
  if (params.get("error")) {
    return backToConnections(request, projectId, { failure: "denied" })
  }

  const code = params.get("code")
  const state = params.get("state")
  if (!stored || !code || !state || state !== stored.state) {
    return backToConnections(request, projectId, { failure: "state" })
  }

  const config = getLinkedInConfig(request.nextUrl.origin)
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

  const token = await exchangeCodeForToken(config, code)
  if (!token.ok) {
    return backToConnections(request, projectId, { failure: token.failure })
  }

  const profile = await fetchLinkedInProfile(token.value.accessToken)
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
      platform: "linkedin",
      provider_account_id: profile.value.id,
      account_name: profile.value.name,
      account_email: profile.value.email,
      avatar_url: profile.value.pictureUrl,
      // Same AES-256-GCM envelope and key as users' provider API keys — the
      // function is named for that first use, but the property it provides
      // (a leaked row is useless without MODEL_KEY_ENCRYPTION_KEY) is exactly
      // what an access token needs too.
      encrypted_access_token: encryptApiKey(token.value.accessToken),
      scope: token.value.scope,
      expires_at: token.value.expiresAt.toISOString(),
      connected_at: new Date().toISOString(),
    },
    { onConflict: "project_id,platform" }
  )

  if (error) {
    return backToConnections(request, projectId, { failure: "save" })
  }

  return backToConnections(request, stored.projectId, { connected: true })
}
