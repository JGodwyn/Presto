import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { isLivePublishEnabled } from "@/lib/linkedin/publish"
import {
  dueWindow,
  partitionSchedulableAccounts,
  PUBLISH_BATCH_LIMIT,
  PUBLISH_GRACE_MINUTES,
  type AccountSkipReason,
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
  // The connections this tick refused to send through, and why. Reported
  // rather than merely acted on: excluding an account's posts instead of
  // marking each one failed is the quieter choice, and the whole risk of it
  // is that a broken connection hides indefinitely (lib/publish-due.ts). A
  // run summary that names them is what keeps that visible.
  skippedAccounts: { projectId: string; platform: string; reason: AccountSkipReason }[]
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

  // **Connections first, posts second.** A post can only go out through a
  // connection that is alive, and a refusal at the gate records nothing — so a
  // post behind a stale grant used to come back every tick, and being the
  // oldest in the window it filled the whole batch limit and starved newer
  // posts on healthy connections. Asking the connection question one layer
  // earlier means those posts are never selected at all: they wait quietly,
  // clean, until the member reconnects. See lib/publish-due.ts for the
  // decision and what it costs.
  //
  // **This reads every LinkedIn connection there is, and that is the order it
  // has to be in.** Selecting due posts first and filtering afterwards would
  // put the broken ones back inside the batch limit, which is the starvation
  // being fixed. It is fine at this app's size and is not fine at a large one —
  // see FOLLOWUPS for the join/RPC that replaces it when there are enough
  // connections for one page of them to matter.
  const { data: accountRows, error: accountsError } = await supabase
    .from("social_accounts")
    .select("project_id, platform, scope, expires_at, status")
    .eq("platform", "linkedin")

  if (accountsError) {
    return NextResponse.json(
      { error: "Couldn't read the connections." },
      { status: 500 }
    )
  }

  const { eligibleProjectIds, skipped } = partitionSchedulableAccounts(
    accountRows.map((row) => ({
      projectId: row.project_id as string,
      platform: row.platform as string,
      scope: row.scope as string,
      expiresAt: row.expires_at as string,
      status: row.status as string,
    })),
    now
  )

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
  //   project_id in eligible — the connection behind it can actually send
  //
  // Ordered oldest-first within the window so a busy minute drains in the order
  // the posts were meant to go out, and capped so a mistake stays small.
  //
  // The eligibility list is also why the query is skipped outright when it is
  // empty: `.in("project_id", [])` is a query that can only return nothing,
  // and running it once a minute to learn that is work for no answer.
  const { data: duePosts, error } = eligibleProjectIds.length
    ? await supabase
        .from("posts")
        .select("id, project_id, scheduled_for")
        .is("published_at", null)
        .is("publish_error", null)
        .eq("is_tryout", false)
        .eq("platform", "linkedin")
        .in("project_id", eligibleProjectIds)
        .gte("scheduled_for", window.from)
        .lte("scheduled_for", window.to)
        .order("scheduled_for", { ascending: true })
        .limit(PUBLISH_BATCH_LIMIT)
    : { data: [] as { id: string; project_id: string; scheduled_for: string }[], error: null }

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
    skippedAccounts: skipped.map(({ account, reason }) => ({
      projectId: account.projectId,
      platform: account.platform,
      reason,
    })),
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

      // The throw almost certainly happened *after* the claim was taken —
      // decryptApiKey is the realistic thrower and it runs post-claim — so the
      // row is left with publish_started_at set and publish_error null. That
      // post then ages out of the 15-minute due window before its 16-minute
      // claim lapses, so nothing ever selects it again: never retried, never
      // marked, and this response body the only trace it happened.
      //
      // Releasing the claim and recording the reason puts it back in the one
      // state a person can see and act on. Safe to release here precisely
      // because nothing was published: publishOnePost handles both paths where
      // a share did go out (record_failed, published_without_urn) internally
      // and returns rather than throwing.
      const { error: releaseError } = await supabase
        .from("posts")
        .update({ publish_started_at: null, publish_error: "publish" })
        .eq("id", post.id)
        .eq("project_id", post.project_id)

      outcome = { ok: false, failure: "publish", recorded: !releaseError }
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
