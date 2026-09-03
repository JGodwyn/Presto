import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

// The service-role client: **this bypasses RLS entirely.**
//
// Every other Supabase client in this app carries a user's session, and RLS is
// what keeps one person's rows away from another's. This one carries the
// service key, so it can read and write every row in the database regardless of
// who owns it. That is not a convenience — it is the only way to do work with
// no user attached, which is what the scheduler is: a cron tick belongs to
// nobody and has to publish whichever user's post happens to be due.
//
// **The rules for anything that uses it:**
//
//   1. Never on a path a browser can reach without a shared secret. Today there
//      is exactly one caller, app/api/cron/publish/route.ts, and it checks
//      CRON_SECRET before this is even constructed.
//   2. Every query carries its own scoping, because nothing else will. The
//      protection RLS normally provides has to be written out by hand in the
//      `where` clause, and reviewed as if it were the security boundary — it is.
//   3. Never pass it to code that also serves user requests unless that code
//      takes the client as a parameter and does no authorisation of its own
//      (lib/publish-runner.ts is written to that contract, and says so).
//
// FOLLOWUPS #3 already notes that a service-role client is "strictly worse than
// the thing being fixed" when reached for casually. This is the case it was not
// arguing against: there is no session to scope to, and no user to ask.

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for scheduled publishing"
    )
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      // No session to persist and none to refresh: this client is constructed
      // per request, does its work, and is thrown away. Left on, the library
      // would try to keep a session it never had.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
