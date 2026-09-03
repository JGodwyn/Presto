"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { NETWORK_ERROR_MESSAGE } from "@/lib/network-error"
import { PUBLISH_FAILURE_MESSAGES } from "@/lib/publish-failure"
import {
  publishOnePost,
  type PublishOutcomeFailure,
} from "@/lib/publish-runner"
import { createClient } from "@/lib/supabase/server"

import { requireUser } from "./post-actions"

// Publishing one post to the live LinkedIn account connected to its project,
// on behalf of the signed-in user who pressed the button.
//
// **Whether this can post anything is decided at runtime, not here.** The gate
// in lib/linkedin/publish.ts still refuses everything while
// `PRESTO_ENABLE_LIVE_PUBLISH` is unset, which is its default — see AGENTS.md's
// hard publishing constraint, which continues to govern turning that key.
//
// This is now a thin wrapper: authorise, then hand off to `publishOnePost`
// (lib/publish-runner.ts), which the scheduler runs too. The claim that stops a
// post going out twice lives there precisely so there is one copy of it.

const publishPostSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
})

// The refusals that are about the post rather than the provider. The rest come
// from PUBLISH_FAILURE_MESSAGES, which the card's own failed treatment reads
// too, so a failure is worded the same wherever it is shown.
const OUTCOME_MESSAGES: Partial<Record<PublishOutcomeFailure, string>> = {
  missing: "That post no longer exists.",
  tryout: "Try out posts can't be published to a real account.",
  unsupported_platform: "Only LinkedIn publishing is built.",
  already_published: "That post has already been published.",
  claimed: "That post is already being published.",
  read_failed: PUBLISH_FAILURE_MESSAGES.publish,
  // The post went out and the row does not say so. Deliberately not phrased as
  // a failure to publish — telling someone their post failed when it is live on
  // their timeline is the one wrong answer here.
  record_failed:
    "That post published, but we couldn't record it. Check LinkedIn before trying again.",
}

function messageFor(failure: PublishOutcomeFailure): string {
  return (
    OUTCOME_MESSAGES[failure] ??
    PUBLISH_FAILURE_MESSAGES[failure as keyof typeof PUBLISH_FAILURE_MESSAGES] ??
    PUBLISH_FAILURE_MESSAGES.publish
  )
}

export type PublishPostResult =
  | { error: string; failure?: PublishOutcomeFailure; recorded?: true }
  | { ok: true; postUrn: string; publishedAt: string }

export async function publishPost(
  input: z.infer<typeof publishPostSchema>
): Promise<PublishPostResult> {
  const parsed = publishPostSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't publish that post." }
  }

  const supabase = await createClient()
  const auth = await requireUser(supabase)
  if (!auth.user) {
    return {
      error: auth.offline ? NETWORK_ERROR_MESSAGE : "You need to be signed in.",
    }
  }

  // RLS is what scopes this to the caller's own rows: the runner takes whatever
  // client it is given, and this one carries the user's session.
  const outcome = await publishOnePost(supabase, {
    projectId: parsed.data.projectId,
    postId: parsed.data.id,
  })

  revalidatePath(`/projects/${parsed.data.projectId}/calendar`)

  if (!outcome.ok) {
    return outcome.recorded
      ? {
          error: messageFor(outcome.failure),
          failure: outcome.failure,
          recorded: true,
        }
      : { error: messageFor(outcome.failure), failure: outcome.failure }
  }

  return {
    ok: true,
    postUrn: outcome.postUrn,
    publishedAt: outcome.publishedAt,
  }
}
