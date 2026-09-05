import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  requireUser,
  resolveGenerationContext,
} from "@/app/projects/[projectId]/generate/post-actions"
import { buildPostPrompt } from "@/lib/ai/build-prompt"
import { STREAM_DONE_MARKER, STREAM_ERROR_MARKER, type GenerationFailureReason } from "@/lib/ai/model-constants"
import { classifyGenerationError, streamPost } from "@/lib/ai/generate"
import { resolveModelSelection } from "@/lib/ai/resolve-model"
import { pickDifferentTasteTestContent } from "@/lib/ai/taste-test"
import { NETWORK_ERROR_MESSAGE } from "@/lib/network-error"
import type { PostRow } from "@/lib/supabase/queries"
import { fetchInstructions, mapPostRow, POST_COLUMNS } from "@/lib/supabase/queries"
import { isPostLocked } from "@/lib/post-publish"
import { createClient } from "@/lib/supabase/server"

// The post-details page's Regenerate — this app's first Route Handler,
// needed only because a plain "use server" action returns a single
// serialized value once fully resolved and can't stream chunks back over
// that round trip. Everything else (auth, row/Instructions fetch, model
// resolution, prompt building) mirrors regeneratePost in post-actions.ts —
// the two genuinely diverge only at the actual model call: generateText
// there, streamText (piped straight through) here.
const requestSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
  model: z.string().min(1).max(200),
  guidance: z.string().trim().max(500).optional(),
  // The subject to rewrite about, picked in the regenerate modal. Absent
  // means "keep whatever this post was already on". Same 80-char ceiling the
  // instructions action puts on a topic.
  topic: z.string().trim().min(1).max(80).optional(),
  // The platform to write *for*, when it differs from the one the post is
  // currently on. Set only by the too-long-to-switch flow: the post is still
  // on LinkedIn at this point and must stay there until the new text exists,
  // so the row cannot be the source of truth for which limits apply. It is a
  // prompt input and nothing else — this route never writes `platform`, and
  // the client applies the switch itself once the stream has landed.
  targetPlatform: z.enum(["linkedin", "x"]).optional(),
})

// Without this the ceiling is whatever the deployment platform defaults to
// ("Set by deployment platform" per Next's route-segment-config docs), which
// on Vercel is 10-15s -- comfortably shorter than a real generation, so the
// function would be killed mid-stream on ordinary use rather than in some
// edge case. 60s is the Hobby-tier maximum; raise it with the plan if
// generations start bumping it.
export const maxDuration = 60

// How long the framing tee waits for the persisting tee's verdict once the
// model has stopped producing. Only the Supabase update and the BYOK-fallback
// lookup happen in that window, so this is generous; it exists so a callback
// that somehow never fires can't hold the response open.
const PERSIST_WAIT_TIMEOUT_MS = 10_000

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse("Couldn't regenerate that post.", 400)
  }

  const supabase = await createClient()
  const auth = await requireUser(supabase)
  if (!auth.user) {
    return auth.offline
      ? errorResponse(NETWORK_ERROR_MESSAGE, 503)
      : errorResponse("You need to be signed in to regenerate posts.", 401)
  }
  const user = auth.user

  // RLS scopes this to the signed-in user, so someone else's post id reads as
  // a post that doesn't exist — same contract as regeneratePost.
  const { data: existing, error: fetchError } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("id", parsed.data.id)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle()

  if (fetchError || !existing) {
    return errorResponse("Couldn't find that post.", 404)
  }

  // The streaming twin of regeneratePost, and it needs the same refusal: a
  // published post is not rewritten. This route is reachable directly, so the
  // UI hiding the control decides nothing here.
  if (isPostLocked(mapPostRow(existing as PostRow))) {
    return errorResponse(
      "That post has already gone out — draft a follow-up instead.",
      409
    )
  }

  const instructions = await fetchInstructions(supabase, parsed.data.projectId)
  if (!instructions) {
    return errorResponse("Set up your project's Instructions before generating posts.", 400)
  }

  const resolvedModel = await resolveModelSelection(supabase, parsed.data.model)
  if (!resolvedModel) {
    return errorResponse("That model isn't available anymore. Pick another one in Connections.", 400)
  }

  const row = existing as PostRow

  const finish = (content: string) => {
    revalidatePath(`/projects/${parsed.data.projectId}/generate`)
    revalidatePath(`/projects/${parsed.data.projectId}/calendar`)
    return content
  }

  // The modal's pick, falling back to whatever this post was generated under
  // so an untouched reroll stays on the same subject rather than drifting.
  const topic = parsed.data.topic ?? row.topics[0]
  // Only written back when it actually changed — a reroll that keeps the
  // subject shouldn't rewrite the column, and a post with no topic and no
  // pick keeps its empty array rather than gaining one.
  const topicsUpdate =
    topic && topic !== row.topics[0] ? { topics: [topic] } : {}

  // TasteTest has no real model call to stream — respond with the whole
  // swapped-in text as a single chunk so the client's line-reveal still has
  // something to animate, then persist exactly like the real path does.
  if ("kind" in resolvedModel) {
    const content = pickDifferentTasteTestContent(row.content)
    const { error } = await supabase
      .from("posts")
      .update({ content, ...topicsUpdate })
      .eq("id", row.id)
    if (error) return errorResponse("Couldn't save the new post.", 500)
    // The done marker matters just as much on this path: the client requires
    // a positive end-of-stream signal before it will accept a body as a
    // finished post, and this shortcut is a response like any other as far as
    // that check is concerned.
    return new Response(finish(content) + STREAM_DONE_MARKER, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  // No batchContextId: this is a single regenerate, not part of a batch run,
  // so there's nothing to read from or contribute to that cache — always the
  // fresh-resolve path (see resolveGenerationContext's own comment).
  const context = await resolveGenerationContext(
    supabase,
    parsed.data.projectId,
    user.id,
    undefined
  )

  const prompt = buildPostPrompt(instructions, {
    platform: parsed.data.targetPlatform ?? row.platform,
    topic,
    writingStyles: context.writingStyles,
    references: context.references,
    previousContent: row.content,
    guidance: parsed.data.guidance,
  })


  // STREAM_DONE_MARKER promises the client that the new text is *saved*, not
  // merely that the stream ended -- the two tees run independently, so
  // without this the framing tee below could ship DONE while the persisting
  // tee was still failing its update, and the page would render a post the
  // DB never took. Settled exactly once on every path through onEnd.
  let settlePersisted: (saved: boolean) => void = () => {}
  const persisted = new Promise<boolean>((resolve) => {
    settlePersisted = resolve
  })

  const result = streamPost({
    prompt,
    model: resolvedModel.selection,
    onEnd: async (end) => {
      try {
        // A failed/aborted stream (including the client disconnecting, which
        // aborts the underlying request this handler is running in) has
        // nothing real to persist — the post keeps whatever it already had.
        // An empty body is not a post. A stream can end "successfully" with
        // no text at all (a safety stop, a zero-length completion), and
        // persisting that would silently wipe the post the user was trying to
        // improve. Treated as a failure so the existing text survives.
        if (!end.ok || !end.content.trim()) {
          settlePersisted(false)
          return
        }

        // No BYOK-fallback bookkeeping — see post-actions.ts's runGeneration.

        const { error } = await supabase
          .from("posts")
          .update({ content: end.content, ...topicsUpdate })
          .eq("id", row.id)
        if (!error) finish(end.content)
        settlePersisted(!error)
      } catch {
        // An onEnd that throws must still settle, or the framing tee below
        // would wait out its whole timeout before reporting a failure.
        settlePersisted(false)
      }
    },
  })

  // Not result.toTextStreamResponse() — that pipes result.textStream straight
  // through with no framing, so a mid-stream model failure (rate limit, bad
  // key, provider 5xx) had no way to signal itself: the response already got
  // its 200 the instant headers were flushed, streamText's own default
  // onError just console.errors, and the client would see the connection end
  // normally and treat whatever partial text had arrived as the finished
  // post — while the onEnd above (correctly) skipped persisting it, leaving
  // the page's own view of the post out of sync with what's actually saved.
  // Reading result.fullStream ourselves instead — a separate tee off the same
  // underlying stream, so the onEnd callback above still fires exactly as it
  // did — lets this watch for an "error" part and append STREAM_ERROR_MARKER
  // once the stream ends, so post-details.tsx can tell a real failure apart
  // from a normal finish.
  const encoder = new TextEncoder()
  let sawError = false
  // Why it failed, when the stream said so. Written after the error marker
  // below so the page can name a quota hit instead of reporting it as our own
  // failure — the status code that carries that is inside the error part, and
  // is otherwise thrown away here (the response's own 200 went out with the
  // headers, long before the model got as far as refusing).
  let failureReason: GenerationFailureReason | undefined
  // Whether anything was actually produced. A stream that ends cleanly having
  // emitted nothing is a failure from the reader's point of view — there is no
  // new post — and it must not be reported as a success, or the client would
  // replace the post with an empty string.
  let sawText = false
  const framedStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            // Trimmed, to match the persisting tee's own `!end.content.trim()`
            // test exactly. Untrimmed, a whitespace-only completion ("  \n ")
            // passed here and failed there: the client got DONE, accepted it,
            // and rendered an empty post that was never saved -- a reload
            // silently brought the old text back.
            if (part.text.trim().length > 0) sawText = true
            controller.enqueue(encoder.encode(part.text))
          } else if (part.type === "error") {
            sawError = true
            failureReason = classifyGenerationError(part.error)
          }
        }
      } catch (error) {
        sawError = true
        failureReason = classifyGenerationError(error)
      } finally {
        // Exactly one of the two always goes out, so the client can tell a
        // finished stream from a severed one: a response that ends carrying
        // neither marker was cut off in transit and is never treated as a
        // result. See STREAM_DONE_MARKER for why that case is real.
        //
        // DONE waits on the *other* tee actually saving the row, so the
        // marker can't outrun the write it stands for. Short-circuited when
        // this tee already knows it failed, which is also what keeps a stream
        // that never reaches onEnd from waiting here at all. The timeout is a
        // backstop for that same case: reporting a failure the client can
        // retry beats holding the response open to the function's own ceiling.
        const saved =
          sawError || !sawText
            ? false
            : await Promise.race([
                persisted,
                new Promise<boolean>((resolve) =>
                  setTimeout(() => resolve(false), PERSIST_WAIT_TIMEOUT_MS)
                ),
              ])
        // The reason rides directly behind the marker, in the same write, so
        // a client that has seen the marker has seen the reason too (it still
        // drains whatever is left before deciding, since nothing guarantees
        // one write arrives as one chunk). Empty when the failure wasn't the
        // model's — an empty completion, or a row that wouldn't save.
        controller.enqueue(
          encoder.encode(
            saved ? STREAM_DONE_MARKER : STREAM_ERROR_MARKER + (failureReason ?? "")
          )
        )
        controller.close()
      }
    },
  })

  return new Response(framedStream, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
