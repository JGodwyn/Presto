import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  requireUser,
  resolveGenerationContext,
  type PostRow,
} from "@/app/projects/[projectId]/generate/post-actions"
import { resolveAttachmentInputs } from "@/lib/ai/attachments"
import { buildPostPrompt } from "@/lib/ai/build-prompt"
import { didFallBackOffByok, STREAM_ERROR_MARKER, streamPost } from "@/lib/ai/generate"
import { resolveModelSelection } from "@/lib/ai/resolve-model"
import { pickDifferentTasteTestContent } from "@/lib/ai/taste-test"
import { NETWORK_ERROR_MESSAGE } from "@/lib/network-error"
import { fetchInstructions } from "@/lib/supabase/queries"
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
})

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
    .select("id, project_id, platform, status, content, topics, scheduled_for, created_at")
    .eq("id", parsed.data.id)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle()

  if (fetchError || !existing) {
    return errorResponse("Couldn't find that post.", 404)
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

  // TasteTest has no real model call to stream — respond with the whole
  // swapped-in text as a single chunk so the client's line-reveal still has
  // something to animate, then persist exactly like the real path does.
  if ("kind" in resolvedModel) {
    const content = pickDifferentTasteTestContent(row.content)
    const { error } = await supabase.from("posts").update({ content }).eq("id", row.id)
    if (error) return errorResponse("Couldn't save the new post.", 500)
    return new Response(finish(content), {
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
    platform: row.platform,
    // Whatever topic this post was generated under, so a reroll stays on
    // the same subject rather than drifting to a different one.
    topic: row.topics[0],
    writingStyles: context.writingStyles,
    references: context.references,
    previousContent: row.content,
    guidance: parsed.data.guidance,
  })

  const { fileParts, useUrlContext } = resolveAttachmentInputs([
    ...context.writingStyles,
    ...context.references,
  ])

  const result = streamPost({
    prompt,
    fileParts,
    useUrlContext,
    model: resolvedModel.selection,
    onEnd: async (end) => {
      // A failed/aborted stream (including the client disconnecting, which
      // aborts the underlying request this handler is running in) has
      // nothing real to persist — the post keeps whatever it already had.
      if (!end.ok) return

      // Same BYOK-fallback bookkeeping as the non-streaming path
      // (post-actions.ts's runGeneration) — non-fatal in both directions.
      if (resolvedModel.modelRowId && (await didFallBackOffByok(end.generationId))) {
        try {
          await supabase
            .from("user_ai_models")
            .update({
              status: "error",
              last_error: "Your API key didn't work, so this ran on Presto's own credits.",
            })
            .eq("id", resolvedModel.modelRowId)
        } catch {
          // Non-fatal.
        }
      }

      const { error } = await supabase
        .from("posts")
        .update({ content: end.content })
        .eq("id", row.id)
      if (!error) finish(end.content)
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
  const framedStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            controller.enqueue(encoder.encode(part.text))
          } else if (part.type === "error") {
            sawError = true
          }
        }
      } catch {
        sawError = true
      } finally {
        if (sawError) controller.enqueue(encoder.encode(STREAM_ERROR_MARKER))
        controller.close()
      }
    },
  })

  return new Response(framedStream, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
