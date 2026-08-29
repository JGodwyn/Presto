import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { isNetworkError } from "@/lib/network-error"

// Everything signed-in lives under these three: the dashboard sections all
// moved to /projects/<id>/…; /profile and /settings are redirect stubs into
// the first project (the name chip on /projects has no project in scope).
const PROTECTED_PREFIXES = [
  "/create-project",
  "/projects",
  "/profile",
  "/settings",
]

// @supabase/ssr stores the session as `sb-<project-ref>-auth-token`, split
// across `.0`/`.1` suffixes when it outgrows one cookie. Its presence isn't
// proof of a valid session — only that this browser had one recently enough
// to be worth not evicting when the auth server can't be reached to confirm.
function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"))
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase isn't configured yet (no .env.local) — skip auth redirects
    // rather than crashing every request.
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.getUser()
  const user = data.user

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  )

  // A getUser() that couldn't reach the auth server looks exactly like a
  // signed-out one — both yield no user — and treating it as signed out is
  // what bounced people to /login mid-session on a bad connection. When the
  // browser is still carrying a session cookie, the more likely story by far
  // is "we couldn't check" rather than "they're signed out", so the request
  // is let through: RLS still gates every row, so the worst case is a page
  // that renders with no data rather than one that leaks any.
  if (!user && isProtectedRoute && error && isNetworkError(error)) {
    if (hasSessionCookie(request)) return response
  }

  // Only a navigation can be sent to /login. A Server Action arrives as a
  // POST to the page's own URL, and redirecting one is worse than useless:
  // the browser's action fetch follows the 307 with its `Next-Action` header
  // still attached, which Next answers with a plain 404 that React can't read
  // as an action result — so the promise never settles and whatever triggered
  // it spins forever. That is exactly what broke logging out with an expired
  // session: the sign-out was bounced here and never ran, while a refresh of
  // the page redirected as normal, which is why it *looked* like it had.
  // Letting the POST through costs nothing: RLS gates every row, and each
  // action does its own user check.
  if (!user && isProtectedRoute && request.method === "GET") {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return response
}
