import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import {
  buildAuthorizationUrl,
  createPkcePair,
  getXConfig,
  OAUTH_STATE_COOKIE,
  resolveRequestOrigin,
  OAUTH_STATE_TTL_SECONDS,
  type XFailure,
} from "@/lib/x/oauth"
import { fetchProject } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

// Step one of the X connect flow: hand the browser off to X's consent screen.
//
// A Route Handler rather than a server action, for the same reason as its
// LinkedIn counterpart: OAuth is a *browser redirect* protocol, so the return
// leg has to be a GET endpoint at a fixed registered path, and the outbound leg
// is paired with it here (both read the same config, both own the same cookie).
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

const paramsSchema = z.object({ projectId: z.string().uuid() })

function failed(
  request: NextRequest,
  projectId: string | null,
  failure: XFailure
) {
  // Nowhere sensible to send someone whose project id was junk — the projects
  // list is the one page that's certainly theirs.
  const path = projectId ? `/projects/${projectId}/connections` : "/projects"
  const url = new URL(path, originOf(request))
  url.searchParams.set("connect_error", failure)
  // Which provider failed, so the toast names X rather than LinkedIn.
  // LinkedIn's own routes don't set this; its absence reads as LinkedIn.
  url.searchParams.set("connect_error_platform", "x")
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const parsed = paramsSchema.safeParse({
    projectId: request.nextUrl.searchParams.get("projectId"),
  })
  if (!parsed.success) return failed(request, null, "project")

  const { projectId } = parsed.data

  const config = getXConfig(originOf(request))
  if (!config) return failed(request, projectId, "config")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return failed(request, projectId, "session")

  // RLS makes someone else's project read as one that doesn't exist, so this is
  // the ownership check as well as the existence check.
  const project = await fetchProject(supabase, projectId)
  if (!project) return failed(request, projectId, "project")

  // CSRF: the callback only accepts a `state` matching this cookie, so an
  // authorization code delivered by anyone but the browser that started the
  // flow is rejected. The project id rides in the cookie rather than in `state`
  // itself — it's then covered by the same comparison instead of being an
  // attacker-supplied value the callback would have to re-validate.
  const state = randomBytes(32).toString("base64url")

  // PKCE, which X requires. The verifier never leaves this server: only its
  // SHA-256 goes to X now, and the verifier itself is presented at the token
  // exchange to prove we are the party that started the flow.
  const { verifier, challenge } = createPkcePair()

  const cookieStore = await cookies()
  cookieStore.set(
    OAUTH_STATE_COOKIE,
    JSON.stringify({ state, projectId, verifier }),
    {
      // The verifier is a secret for the length of the flow, so this cookie
      // must stay unreadable to scripts.
      httpOnly: true,
      // Must be lax, not strict: the callback arrives as a top-level navigation
      // from x.com, and a strict cookie wouldn't be sent with it.
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: OAUTH_STATE_TTL_SECONDS,
    }
  )

  return NextResponse.redirect(buildAuthorizationUrl(config, state, challenge))
}
