import { ContentView } from "@/components/content/content-view"
import { GlowPanel } from "@/components/shared/glow-panel"
import {
  fetchInstructions,
  fetchPosts,
  fetchSocialAccounts,
} from "@/lib/supabase/queries"
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
  // Three independent reads — the posts themselves, the connected accounts a
  // post card names instead of its bare platform, and the project's current
  // topic list, which is the only thing that can tell a live topic chip from
  // one whose topic has since been deleted from Instructions.
  const [posts, accounts, instructions] = await Promise.all([
    fetchPosts(supabase, projectId),
    fetchSocialAccounts(supabase, projectId),
    fetchInstructions(supabase, projectId),
  ])

  // No `now` is stamped here any more, and that is the point: which tab a post
  // is on is a property of the post (published or not, dated or not), so it no
  // longer moves with the clock and cannot differ between the server render and
  // hydration. This used to need a once-per-request timestamp threaded down,
  // plus a react-hooks/purity exception to produce it.

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
        {/* No info marker: the header's own search control replaces it on
            this page (components/content/content-search.tsx). */}
        <GlowPanel showInfoMarker={false}>
          <ContentView
            projectId={projectId}
            posts={posts}
            accounts={accounts}
            activeTopics={instructions?.topics ?? []}
          />
        </GlowPanel>
      </div>
    </div>
  )
}
