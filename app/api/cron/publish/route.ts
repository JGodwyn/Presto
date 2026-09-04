import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { isLivePublishEnabled } from "@/lib/linkedin/publish"
import {
  dueWindow,
  PUBLISH_BATCH_LIMIT,
  PUBLISH_GRACE_MINUTES,
} from "@/lib/publish-due"
import { publishOnePost, type PublishOutcomeFailure } from "@/lib/publish-runner"
import { createServiceClient } from "@/lib/supabase/service"

// The scheduler: the thing that makes a scheduled post mean something.
//
// Called on a timer from Postgres (pg_cron + pg_net), not by a browser and not
// by a user — so it authenticates with a shared secret and runs on a
// service-role client, which is the only way to reach a post belonging to
// whichever user happens to have one due. Read lib/supabase/service.ts before
// changing the query below: RLS is not protecting anything here.
//
// **It publishes only what came due in the last few minutes.** Not the backlog,
// ever — see lib/publish-due.ts for the rule and the reason. Everything else it
// finds is reported in the response and left exactly where it was.
//
// **And it still cannot post anything while the gate is shut.** Every send goes
// through publishOnePost, which checks `PRESTO_ENABLE_LIVE_PUBLISH` like the
// button does; with the key unset this endpoint is a dry run that reports what
// it *would* have sent. That is deliberately the state it ships in.

// Node, not Edge: the runner decrypts an access token with node:crypto.
export const runtime = "nodejs"
// Nothing about a cron run should be cached or statically analysed.
export const dynamic = "force-dynamic"

interface RunSummary {
  ranAt: string
  livePublishEnabled: boolean
  window: { from: string; to: string; graceMinutes: number }
  due: number
  published: number
  failed: number
  results: {
    postId: string
    ok: boolean
    failure?: PublishOutcomeFailure
    postUrn?: string
    publishedUrn?: string
  }[]
}

function unauthorized(): NextResponse {
  // No detail: an endpoint that explains why a secret was wrong is helping
  // whoever is guessing at it.
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET

  // Refuses outright when unconfigured, rather than running unauthenticated.
  // A missing secret is a deployment mistake, and the safe reading of it is
  // "nobody may run this" — never "everybody may".
  if (!secret) return unauthorized()

  // pg_net sends it as a header; a manual curl can do the same.
  //
  // `timingSafeEqual`, not `!==`: string comparison short-circuits at the first
  // differing byte, which is exactly the measurement a length check ahead of it
  // was wrongly claimed to prevent. It throws on a length mismatch, so that is
  // checked separately — and a length difference is not worth hiding, since it
  // is observable from the header the caller already sent.
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  const providedBytes = Buffer.from(provided)
  const secretBytes = Buffer.from(secret)
  if (
    providedBytes.length !== secretBytes.length ||
    !timingSafeEqual(providedBytes, secretBytes)
  ) {
    return unauthorized()
  }

  const supabase = createServiceClient()
  const now = new Date()
  const window = dueWindow(now)

  // The selection query, and the security boundary. Every condition here is
  // doing work that RLS would normally do or that the backlog rule requires:
  //
  //   published_at is null   — never send the same post twice
  //   publish_error is null  — a failed post is not retried on its own; it
  //                            wears the "Didn't send" marker until a person
  //                            decides, since retrying blind is how a broken
  //                            connection becomes a stream of failures
  //   is_tryout false        — a try-out post borrows a real platform value
  //   platform linkedin      — the only publishing flow that exists
  //   scheduled_for in window— came due, and came due *recently*
  //
  // Ordered oldest-first within the window so a busy minute drains in the order
  // the posts were meant to go out, and capped so a mistake stays small.
  const { data: duePosts, error } = await supabase
    .from("posts")
    .select("id, project_id, scheduled_for")
    .is("published_at", null)
    .is("publish_error", null)
    .eq("is_tryout", false)
    .eq("platform", "linkedin")
    .gte("scheduled_for", window.from)
    .lte("scheduled_for", window.to)
    .order("scheduled_for", { ascending: true })
    .limit(PUBLISH_BATCH_LIMIT)

  if (error) {
    return NextResponse.json(
      { error: "Couldn't read the schedule." },
      { status: 500 }
    )
  }

  const summary: RunSummary = {
    ranAt: now.toISOString(),
    livePublishEnabled: isLivePublishEnabled(),
    window: { ...window, graceMinutes: PUBLISH_GRACE_MINUTES },
    due: duePosts.length,
    published: 0,
    failed: 0,
    results: [],
  }

  // Sequential, not Promise.all: these are writes against one person's LinkedIn
  // account through one rate limit, and the claim inside the runner is what
  // makes each one safe on its own — running them together buys a second or two
  // and gives up the ordering the query just established.
  for (const post of duePosts) {
    // Wrapped per post, not around the loop. `decryptApiKey` throws on a
    // corrupt or re-keyed token, and it throws *after* the claim is taken — so
    // an unguarded loop let one undecryptable token both strand its own post
    // and 500 the whole route, stopping publishing for every other project on
    // every tick until someone noticed. One post's problem stays one post's.
    let outcome: Awaited<ReturnType<typeof publishOnePost>>
    try {
      outcome = await publishOnePost(supabase, {
        projectId: post.project_id,
        postId: post.id,
      })
    } catch (error) {
      console.error(`[publish] post ${post.id} threw`, error)
      outcome = { ok: false, failure: "publish", recorded: false }
    }

    if (outcome.ok) {
      summary.published += 1
      summary.results.push({ postId: post.id, ok: true, postUrn: outcome.postUrn })
    } else {
      summary.failed += 1
      summary.results.push({
        postId: post.id,
        ok: false,
        failure: outcome.failure,
        // Carried through only for `record_failed`, where the post is live and
        // the row does not know it. The response is the last place this URN
        // exists, so it is also logged: a cron response nobody reads is not a
        // record of something that cannot be undone.
        ...(outcome.publishedUrn ? { publishedUrn: outcome.publishedUrn } : {}),
      })

      if (outcome.publishedUrn) {
        console.error(
          `[publish] post ${post.id} is live at ${outcome.publishedUrn} but its row could not be updated — reconcile by hand`
        )
      }
    }
  }

  return NextResponse.json(summary)
}
