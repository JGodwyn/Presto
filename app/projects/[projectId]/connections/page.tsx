import { ConnectionsPanel } from "@/components/connections/connections-panel"

// Connections screen from the Figma "Connect / Base" + "Social Connected"
// exports — social accounts only (BYOK AI models moved to Settings, where a
// user-scoped API key belongs). No GlowPanel here: both exports put the
// content straight on the page background.
//
// UI only, by request: nothing connects to LinkedIn and nothing persists yet.
// See ConnectionsPanel for what changes when the real OAuth flow lands.
export default function ConnectionsPage() {
  return (
    // Same unified blur+opacity mount-in as the dashboard and Instructions
    // pages (see those for the @starting-style rationale).
    <div className="flex flex-1 flex-col transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      {/* The expiry countdown needs a "now", stamped once here for the request
          so the server render and hydration agree. react-hooks/purity flags
          any Date.now() in render; the instability it guards against needs a
          re-render to bite, and this renders once per request on the server —
          same reasoning as the Content page's own stamp. */}
      {/* eslint-disable-next-line react-hooks/purity */}
      <ConnectionsPanel now={Date.now()} />
    </div>
  )
}
