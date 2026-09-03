import { ConnectionsPanel } from "@/components/connections/connections-panel"
import { fetchSocialAccounts } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

// Connections screen from the Figma "Connect / Base" + "Connection -
// connected" exports — social accounts only (BYOK AI models moved to Settings,
// where a user-scoped API key belongs). No GlowPanel here: both exports put
// the content straight on the page background.
//
// Connecting is a browser redirect out to LinkedIn and back, so it lives in
// app/api/connections/linkedin/{authorize,callback}/route.ts rather than in a
// server action; the callback returns here with `?connected=` or
// `?connect_error=`, which the panel reports and then clears from the URL.
export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  // Next hands a repeated param (`?connected=a&connected=b`) through as an
  // array, so the honest type is the union — narrowed below rather than
  // asserted away.
  searchParams: Promise<{
    connected?: string | string[]
    connect_error?: string | string[]
    connect_error_platform?: string | string[]
  }>
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams])
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? null
  const supabase = await createClient()
  const accounts = await fetchSocialAccounts(supabase, projectId)
  // The expiry countdown needs a "now", stamped once here for the request so
  // the server render and hydration agree. react-hooks/purity flags any
  // Date.now() in render; the instability it guards against needs a re-render
  // to bite, and this renders once per request on the server — same reasoning
  // as the Content page's own stamp.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()

  return (
    // Same unified blur+opacity mount-in as the dashboard and Instructions
    // pages (see those for the @starting-style rationale).
    <div className="flex flex-1 flex-col transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      <ConnectionsPanel
        projectId={projectId}
        accounts={accounts}
        now={now}
        connected={first(query.connected)}
        connectError={first(query.connect_error)}
        connectErrorPlatform={first(query.connect_error_platform)}
      />
    </div>
  )
}
