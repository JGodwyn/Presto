"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { NETWORK_ERROR_MESSAGE } from "@/lib/network-error"
import {
  fillProvider,
  PUBLISH_FAILURE_TEMPLATES,
} from "@/lib/publish-failure"
import {
  publishOnePost,
  type PublishOutcomeFailure,
} from "@/lib/publish-runner"
import { createClient } from "@/lib/supabase/server"
import type { PostPlatform } from "@/types/post"

import { requireUser } from "./post-actions"

// Publishing one post to the live account connected to its project — LinkedIn
// or X, whichever the post was written for — on behalf of the signed-in user
// who pressed the button.
//
// **Whether this can post anything is decided at runtime, not here.** Each
// platform's gate refuses everything while `PRESTO_ENABLE_LIVE_PUBLISH` is
// unset, which is its default — see AGENTS.md's hard publishing constraint,
// which continues to govern turning that key.
//
// This is now a thin wrapper: authorise, then hand off to `publishOnePost`
// (lib/publish-runner.ts), which the scheduler runs too. The claim that stops a
// post going out twice lives there precisely so there is one copy of it.

const publishPostSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
})

// The refusals that are about the post rather than the provider. None of these
// name a provider, and that is why they are separate: each is
// reachable before the post's platform is known, or is about the post rather
// than the place it was going.
const OUTCOME_MESSAGES: Partial<Record<PublishOutcomeFailure, string>> = {
  missing: "That post no longer exists.",
  tryout: "Try out posts can't be published to a real account.",
  unsupported_platform: "Publishing isn't built for that platform.",
  already_published: "That post has already been published.",
  claimed: "That post is already being published.",
  read_failed: "Couldn't read that post. Try again.",
}

// The rest come from PUBLISH_FAILURE_TEMPLATES, which the card's own failed
// treatment reads too, so a failure is worded the same wherever it is shown —
// with the provider filled in from the post's own platform. `{provider}` in a
// toast is the tell that a caller skipped `fillProvider`.
const RECORD_FAILED_TEMPLATE =
  "That post published, but we couldn't record it. Check {provider} before trying again."

function messageFor(
  failure: PublishOutcomeFailure,
  platform: PostPlatform | null
): string {
  const plain = OUTCOME_MESSAGES[failure]
  if (plain) return plain

  // Only `read_failed`, `missing` and `unsupported_platform` can arrive without
  // a platform, and all three are handled above — so this is unreachable rather
  // than a fallback worth wording carefully.
  if (!platform) return "Couldn't publish that post."

  if (failure === "record_failed") {
    return fillProvider(RECORD_FAILED_TEMPLATE, platform)
  }

  return fillProvider(
    PUBLISH_FAILURE_TEMPLATES[
      failure as keyof typeof PUBLISH_FAILURE_TEMPLATES
    ] ?? PUBLISH_FAILURE_TEMPLATES.publish,
    platform
  )
}

export type PublishPostResult =
  | {
      error: string
      failure?: PublishOutcomeFailure
      recorded?: true
      // Present only on `record_failed`: the post IS live under this URN even
      // though its row does not say so. **It has to cross this boundary**, or
      // the client mirrors a bare "record_failed" into publish_error while the
      // server wrote "record_failed:<urn>" — and the card then reads the marker
      // as an ordinary failure, says "Didn't send" under a toast saying it
      // published, and changes its story on reload. TypeScript cannot catch
      // that: publishErrorFor takes the field as optional, so dropping it here
      // type-checks perfectly.
      publishedUrn?: string
    }
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
    return {
      error: messageFor(outcome.failure, outcome.platform),
      failure: outcome.failure,
      ...(outcome.recorded ? { recorded: true as const } : {}),
      ...(outcome.publishedUrn ? { publishedUrn: outcome.publishedUrn } : {}),
    }
  }

  return {
    ok: true,
    postUrn: outcome.postUrn,
    publishedAt: outcome.publishedAt,
  }
}
