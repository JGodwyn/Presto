import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

// Supabase returns a PKCE code here after Google has authenticated the user.
// Exchanging it on the server lets @supabase/ssr persist the session in the
// cookies shared with Server Components and the proxy.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/signup?auth_error=google", request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL("/signup?auth_error=google", request.url))
  }

  // / owns the project-aware fan-out: returning users reach their projects,
  // while a first Google login reaches the create-project empty state.
  return NextResponse.redirect(new URL("/", request.url))
}
