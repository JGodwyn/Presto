import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import {
  buildAuthorizationUrl,
  getLinkedInConfig,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  type LinkedInFailure,
} from "@/lib/linkedin/oauth"
import { fetchProject } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

// Step one of the LinkedIn connect flow: hand the browser off to LinkedIn's
// consent screen.
//
// A Route Handler rather than a server action — and this is the "real reason"
// AGENTS.md's server-actions-by-default rule asks for. OAuth is a *browser
// redirect* protocol: LinkedIn sends the member back to a URL it has on file,
// so the return leg has to be a GET endpoint at a fixed path, and the outbound
// leg is paired with it here for symmetry (both legs read the same config,
// both own the same state cookie).
const paramsSchema = z.object({ projectId: z.string().uuid() })

function failed(request: NextRequest, projectId: string | null, failure: LinkedInFailure) {
  // Nowhere sensible to send someone whose project id was junk — the projects
  // list is the one page that's certainly theirs.
  const path = projectId ? `/projects/${projectId}/connections` : "/projects"
  const url = new URL(path, request.nextUrl.origin)
  url.searchParams.set("connect_error", failure)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const parsed = paramsSchema.safeParse({
    projectId: request.nextUrl.searchParams.get("projectId"),
  })
  if (!parsed.success) return failed(request, null, "project")

  const { projectId } = parsed.data

  const config = getLinkedInConfig(request.nextUrl.origin)
  if (!config) return failed(request, projectId, "config")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return failed(request, projectId, "session")

  // RLS makes someone else's project read as one that doesn't exist, so this
  // is the ownership check as well as the existence check.
  const project = await fetchProject(supabase, projectId)
  if (!project) return failed(request, projectId, "project")

  // CSRF: the callback only accepts a `state` that matches this cookie, so an
  // authorization code delivered by anyone but the browser that started the
  // flow is rejected. The project id rides along in the cookie rather than in
  // `state` itself — it's then covered by the same comparison instead of being
  // an attacker-supplied value the callback would have to re-validate.
  const state = randomBytes(32).toString("base64url")

  const cookieStore = await cookies()
  cookieStore.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, projectId }), {
    httpOnly: true,
    // Must be lax, not strict: the callback arrives as a top-level navigation
    // from linkedin.com, and a strict cookie wouldn't be sent with it.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  })

  return NextResponse.redirect(buildAuthorizationUrl(config, state))
}
