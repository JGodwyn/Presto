import { ContentView } from "@/components/content/content-view"
import { GlowPanel } from "@/components/shared/glow-panel"
import { fetchPosts } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

// The Content section (route path stays `calendar` — see AGENTS.md's
// Navigation note), built from the Figma "Content / Empty state" and
// "Content / Base calendar view" exports. Same panel as Generate; the tab
// split and the month sections/day chips live in ContentView.
export default async function ContentPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()
  // The layout already redirected if this project isn't the caller's; under
  // RLS a foreign id would come back empty anyway.
  const posts = await fetchPosts(supabase, projectId)

  return (
    // This page is the viewport's height and scrolls its own content, rather
    // than growing and taking the whole page's scroll with it (per direct
    // feedback). Getting there needs a *definite* height at the panel, and the
    // chain above doesn't supply one: every wrapper up to <main> sizes itself
    // from its content, so a tall list simply pushed them all taller.
    //
    // An absolutely-positioned child is what breaks that. Out of flow, it
    // contributes nothing to the outer div's content-based minimum, so that
    // div collapses to whatever `flex-1` gives it — the space <main> actually
    // has — and inset-0 then hands the panel exactly that height to divide up.
    // Done here rather than by capping the shared section wrapper, which every
    // other section relies on being able to outgrow (they page-scroll).
    <div className="relative flex-1">
      <div className="absolute inset-0 flex flex-col">
        <GlowPanel>
          {/* The queued/published split needs a "now", and it has to be the same
          one on the server and during hydration or a post scheduled seconds
          away could change tabs mid-hydration — so it's stamped once, here,
          for the request. react-hooks/purity flags any Date.now() in render;
          the instability it guards against needs a re-render to bite, and
          this component renders once per request on the server. It does mean
          the split only moves on a refresh, which is the right granularity
          for a page about days. */}
          {/* eslint-disable-next-line react-hooks/purity */}
          <ContentView projectId={projectId} posts={posts} now={Date.now()} />
        </GlowPanel>
      </div>
    </div>
  )
}
