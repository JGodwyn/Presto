"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { decryptApiKey } from "@/lib/ai/key-crypto"
import {
  checkPublishGate,
  publishTextPost,
  type PublishFailure,
} from "@/lib/linkedin/publish"
import { NETWORK_ERROR_MESSAGE } from "@/lib/network-error"
import { createClient } from "@/lib/supabase/server"

import { requireUser } from "./post-actions"

// Publishing one post to the live LinkedIn account connected to its project.
//
// **This cannot currently post anything**, and that is the point — see
// AGENTS.md's hard publishing constraint and the gate in lib/linkedin/publish.ts.
// It is built so that turning publishing on later is a scope migration and a
// switch, not a from-scratch build, and so the refusal path is the part that
// gets exercised first.
//
// Nothing calls this yet: no button, no cron, no scheduler. Wiring a scheduler
// to it is explicitly forbidden until the user green-lights publishing.

// How long a claim (publish_started_at) is honoured before another attempt may
// take it. Longer than any LinkedIn round trip, short enough that a crash does
// not strand a post.
const CLAIM_TIMEOUT_MS = 5 * 60 * 1000

const publishPostSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
})

// The refusals a caller can actually do something about, in the app's own
// voice. Kept here rather than in lib/ so the wording lives with the UI layer
// and the module stays free of copy.
const FAILURE_MESSAGES: Record<PublishFailure, string> = {
  publishing_disabled:
    "Publishing to a live account is switched off for this app.",
  scope_not_granted:
    "This connection doesn't have permission to post. Reconnect the account once publishing is enabled.",
  token_expired: "That connection has expired. Reconnect it and try again.",
  not_connected: "There's no connected account to publish this to.",
  network: NETWORK_ERROR_MESSAGE,
  publish: "Couldn't publish that post. Please try again.",
}

export async function publishPost(
  input: z.infer<typeof publishPostSchema>
): Promise<{ error: string } | { ok: true; postUrn: string }> {
  const parsed = publishPostSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't publish that post." }
  }

  const supabase = await createClient()
  const auth = await requireUser(supabase)
  if (!auth.user) {
    return { error: auth.offline ? NETWORK_ERROR_MESSAGE : "You need to be signed in." }
  }

  // Scoped to the project as well as the id, like every sibling action. RLS
  // alone is not enough here: it scopes to the caller's own rows, but one
  // person owns several projects, so `id` alone would happily publish project
  // A's post through project B's LinkedIn connection — the account is looked
  // up by `projectId` further down. Someone else's post id and a deleted one
  // stay indistinguishable, which is the intended behaviour.
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, platform, content, is_tryout, published_at")
    .eq("id", parsed.data.id)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle()

  if (postError) return { error: FAILURE_MESSAGES.publish }
  if (!post) return { error: "That post no longer exists." }

  // A "Try out" post was written against a stand-in account, not a real one.
  // It borrows a real platform value (see types/post.ts), so without this it
  // would resolve to the user's genuine connection and publish under their
  // name — exactly the accident this check exists to prevent.
  if (post.is_tryout) {
    return { error: "Try out posts can't be published to a real account." }
  }

  if (post.platform !== "linkedin") {
    return { error: "Only LinkedIn publishing is built." }
  }

  // Already out. Checked here for a useful message; the claim below is what
  // actually makes this safe, since two requests can both pass this point.
  if (post.published_at !== null) {
    return { error: "That post has already been published." }
  }

  const { data: account, error: accountError } = await supabase
    .from("social_accounts")
    .select("provider_account_id, scope, expires_at, encrypted_access_token")
    .eq("project_id", parsed.data.projectId)
    .eq("platform", "linkedin")
    .maybeSingle()

  if (accountError) return { error: FAILURE_MESSAGES.publish }
  if (!account) return { error: FAILURE_MESSAGES.not_connected }

  const publishable = {
    providerAccountId: account.provider_account_id,
    scope: account.scope,
    expiresAt: new Date(account.expires_at),
  }

  // Gated *before* the token is decrypted, so a refused publish never puts a
  // plaintext access token in memory at all. publishTextPost checks the same
  // gate again on its own — the duplication is deliberate: this one is about
  // not decrypting, that one is about not requesting.
  const gate = checkPublishGate(publishable, new Date())
  if (!gate.allowed) {
    return { error: FAILURE_MESSAGES[gate.failure] }
  }

  // Claim the post before calling out, so a double click or a retry cannot
  // produce two live posts. The guard is the `.is("published_at", null)` and
  // stale-claim window *inside the update*, not a read beforehand: a check-then
  // -act pair leaves both requests believing they won. Whoever the database
  // hands a row to owns the attempt; everyone else gets nothing back and stops.
  //
  // A claim goes stale after five minutes so a crash mid-publish cannot lock a
  // post out forever. That window is longer than any LinkedIn call, and the
  // cost of getting it wrong is bounded by the published_at check above.
  const staleBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString()
  const { data: claimed, error: claimError } = await supabase
    .from("posts")
    .update({ publish_started_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("project_id", parsed.data.projectId)
    .is("published_at", null)
    .or(`publish_started_at.is.null,publish_started_at.lt.${staleBefore}`)
    .select("id")
    .maybeSingle()

  if (claimError) return { error: FAILURE_MESSAGES.publish }
  if (!claimed) return { error: "That post is already being published." }

  const result = await publishTextPost({
    account: publishable,
    accessToken: decryptApiKey(account.encrypted_access_token),
    content: post.content,
  })

  if (!result.ok) {
    // Release the claim and record why, so the post reads as failed rather
    // than sitting in the queue looking untouched (see hasFailed in
    // lib/content-grouping.ts).
    await supabase
      .from("posts")
      .update({ publish_started_at: null, publish_error: result.failure })
      .eq("id", parsed.data.id)
      .eq("project_id", parsed.data.projectId)

    revalidatePath(`/projects/${parsed.data.projectId}/calendar`)
    return { error: FAILURE_MESSAGES[result.failure] }
  }

  // The one place published-ness is recorded. Every tab, chip and dashboard
  // figure reads `published_at` from here — nothing derives it from the clock
  // any more. `provider_post_id` goes in the same write because a database
  // constraint requires the pair: a post marked published with no id for the
  // thing it became is exactly the state that makes the column untrustworthy.
  await supabase
    .from("posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      provider_post_id: result.postUrn,
      publish_started_at: null,
      publish_error: null,
    })
    .eq("id", parsed.data.id)
    .eq("project_id", parsed.data.projectId)

  revalidatePath(`/projects/${parsed.data.projectId}/calendar`)

  return { ok: true, postUrn: result.postUrn }
}
