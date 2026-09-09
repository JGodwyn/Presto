import { createClient } from "@/lib/supabase/client"

// The browser client starts Supabase's PKCE OAuth flow. The code returns to
// our callback route, which exchanges it into the shared SSR cookie session.
export async function signInWithGoogle() {
  const { error } = await createClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  return error
}
