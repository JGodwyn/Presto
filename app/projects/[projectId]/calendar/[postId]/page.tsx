import { notFound } from "next/navigation"

import { PostDetails } from "@/components/content/post-details"
import { GlowPanel } from "@/components/shared/glow-panel"
import {
  fetchInstructions,
  fetchPost,
  fetchSocialAccounts,
} from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

// A single post, opened from a card on the Content page's Kanban board. Nested
// under `calendar` so the sidebar keeps Content highlighted (it matches on
// startsWith) and the section-navigation overlay treats it as the same
// section.
export default async function PostDetailsPage({
  params,
}: {
  params: Promise<{ projectId: string; postId: string }>
}) {
  const { projectId, postId } = await params
  const supabase = await createClient()
  // Null covers all three of "no such post", "not this project's" and "not
  // yours" — RLS makes the last two indistinguishable, which is the point.
  // The post itself, plus what its account pill and topic chips need: the
  // project's connected accounts, and its current topic list (anything on the
  // post that isn't in it has since been deleted — see the Content page).
  const [post, accounts, instructions] = await Promise.all([
    fetchPost(supabase, projectId, postId),
    fetchSocialAccounts(supabase, projectId),
    fetchInstructions(supabase, projectId),
  ])
  if (!post) notFound()

  return (
    // Same viewport-height treatment as the Content page it opens from — see
    // that page for why the absolutely-positioned child is what caps it.
    <div className="relative flex-1">
      <div className="absolute inset-0 flex flex-col">
        {/* No info marker here: this screen's own three actions sit in that
            corner, and the export shows them there alone. */}
        <GlowPanel showInfoMarker={false}>
          <PostDetails
            post={post}
            accounts={accounts}
            activeTopics={instructions?.topics ?? []}
            backHref={`/projects/${projectId}/calendar`}
          />
        </GlowPanel>
      </div>
    </div>
  )
}
