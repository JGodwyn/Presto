"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { resolveAttachment, type ResolvedAttachment } from "@/lib/ai/attachments"
import { buildPostPrompt, pickTopicForIndex } from "@/lib/ai/build-prompt"
import {
  classifyGenerationError,
  didFallBackOffByok,
  generatePost,
  type GenerationFailureReason,
} from "@/lib/ai/generate"
import { resolveModelSelection } from "@/lib/ai/resolve-model"
import { pickTasteTestContent } from "@/lib/ai/taste-test"
import {
  fetchBatchContext,
  fetchContentReferences,
  fetchInstructions,
  fetchWritingStyles,
} from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"
import { isNetworkError, NETWORK_ERROR_MESSAGE } from "@/lib/network-error"
import type { Post, PostPlatform, PostStatus } from "@/types/post"

const WRITING_STYLE_FILES_BUCKET = "writing-style-files"
const CONTENT_REFERENCE_FILES_BUCKET = "content-reference-files"

type PostRow = {
  id: string
  project_id: string
  platform: PostPlatform
  status: PostStatus
  content: string
  topics: string[]
  scheduled_for: string | null
  created_at: string
}

function mapRow(row: PostRow): Post {
  return {
    id: row.id,
    projectId: row.project_id,
    platform: row.platform,
    status: row.status,
    content: row.content,
    topics: row.topics,
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
  }
}

// Returns the user, or which *kind* of no-user this is. getUser() yields no
// user both when the session is genuinely gone and when the auth server
// couldn't be reached, and the two deserve different messages — "you've been
// signed out" sends someone off to log in again over what was a dropped
// connection.
async function requireUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  if (data.user) return { user: data.user } as const
  return {
    user: null,
    offline: Boolean(error && isNetworkError(error)),
  } as const
}

const generateAndSavePostSchema = z.object({
  projectId: z.string().uuid(),
  platform: z.enum(["linkedin", "x"]),
  // No longer an enum: a value here is either a built-in id or a
  // user_ai_models row id (a uuid). resolveModelSelection below is what
  // actually validates it — and under RLS, so an id belonging to another user
  // is rejected the same way a nonexistent one is.
  model: z.string().min(1).max(200),
  batchIndex: z.number().int().min(0),
  batchTotal: z.number().int().min(1),
  scheduledFor: z.string().datetime().nullable(),
  // Carries the resolved writing-style/reference context across the calls in
  // one batch run (generating-view.tsx's loop calls this once per post) so
  // it only gets resolved — including any Storage file downloads — once
  // instead of once per post. See the cache-aware branch below; entirely
  // optional and best-effort, never a hard dependency for generation to
  // succeed (see WRITING_STYLE_FILES_BUCKET usage below for why).
  batchContextId: z.string().uuid().optional(),
})

export async function generateAndSavePost(
  input: z.infer<typeof generateAndSavePostSchema>
): Promise<
  | { error: string; reason: GenerationFailureReason; batchContextId?: string }
  | { ok: true; post: Post; batchContextId?: string }
> {
  const parsed = generateAndSavePostSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't generate that post.", reason: "unknown" }
  }

  const supabase = await createClient()
  const auth = await requireUser(supabase)
  if (!auth.user) {
    return auth.offline
      ? { error: NETWORK_ERROR_MESSAGE, reason: "network" }
      : { error: "You need to be signed in to generate posts.", reason: "not_signed_in" }
  }
  const user = auth.user

  const instructions = await fetchInstructions(supabase, parsed.data.projectId)
  if (!instructions) {
    return {
      error: "Set up your project's Instructions before generating posts.",
      reason: "missing_instructions",
    }
  }

  const topic = pickTopicForIndex(instructions.topics, parsed.data.batchIndex)

  const resolvedModel = await resolveModelSelection(supabase, parsed.data.model)
  if (!resolvedModel) {
    return {
      error: "That model isn't available anymore. Pick another one in Connections.",
      reason: "model_unavailable",
    }
  }

  // TasteTest skips the real model call entirely (no prompt needed) so the
  // Generate flow's UI — reveal pacing, topic assignment, persistence,
  // review/edit actions — can be exercised for free. Everything else below
  // (the DB row, topics, scheduling) runs exactly as it does for a real
  // model.
  let content: string
  let batchContextId = parsed.data.batchContextId

  if ("kind" in resolvedModel) {
    content = pickTasteTestContent(parsed.data.batchIndex)
  } else {
    let resolvedWritingStyles: ResolvedAttachment[] | undefined
    let resolvedReferences: ResolvedAttachment[] | undefined

    // Cache hit: a single cheap row lookup, no Storage I/O, no DB writes.
    // Any failure here (thrown error or a miss — expired, manually deleted,
    // or no id passed at all) falls through to a fresh resolve below rather
    // than surfacing as a generation failure — this cache is purely
    // additive, never a hard dependency for a post to generate.
    if (batchContextId) {
      try {
        const cached = await fetchBatchContext(supabase, parsed.data.projectId, batchContextId)
        if (cached) {
          resolvedWritingStyles = cached.writingStyles
          resolvedReferences = cached.contentReferences
        }
      } catch {
        // Falls through to the fresh resolve below.
      }
    }

    if (!resolvedWritingStyles || !resolvedReferences) {
      const [writingStyles, references] = await Promise.all([
        fetchWritingStyles(supabase, parsed.data.projectId),
        fetchContentReferences(supabase, parsed.data.projectId),
      ])
      resolvedWritingStyles = (
        await Promise.all(
          writingStyles.map((entry) => resolveAttachment(supabase, WRITING_STYLE_FILES_BUCKET, entry))
        )
      ).filter((attachment): attachment is ResolvedAttachment => attachment !== null)
      resolvedReferences = (
        await Promise.all(
          references.map((entry) => resolveAttachment(supabase, CONTENT_REFERENCE_FILES_BUCKET, entry))
        )
      ).filter((attachment): attachment is ResolvedAttachment => attachment !== null)

      // No cache row to reuse — this call pays the real resolve cost, same
      // as every call did before this cache existed. Best-effort sweep +
      // insert so the REST of this batch can reuse the result instead of
      // paying it again: neither is allowed to fail this post's generation,
      // so batchContextId simply stays unset on any error here, which just
      // means the next call in the batch takes this same miss path too —
      // i.e. the batch degrades to exactly its pre-cache behavior, never a
      // harder failure.
      batchContextId = undefined

      try {
        await supabase
          .from("generation_batch_context")
          .delete()
          .eq("user_id", user.id)
          .lt("expires_at", new Date().toISOString())
      } catch {
        // Non-fatal — the insert below is still attempted.
      }

      try {
        const { data: cacheRow, error: cacheError } = await supabase
          .from("generation_batch_context")
          .insert({
            project_id: parsed.data.projectId,
            user_id: user.id,
            writing_styles: resolvedWritingStyles,
            content_references: resolvedReferences,
          })
          .select("id")
          .single()

        if (!cacheError && cacheRow) {
          batchContextId = cacheRow.id
        }
      } catch {
        // Non-fatal — batchContextId stays undefined.
      }
    }

    const prompt = buildPostPrompt(instructions, {
      platform: parsed.data.platform,
      topic,
      batchContext: { index: parsed.data.batchIndex, total: parsed.data.batchTotal },
      writingStyles: resolvedWritingStyles,
      references: resolvedReferences,
    })

    const allAttachments = [...resolvedWritingStyles, ...resolvedReferences]
    const fileParts = allAttachments
      .filter((attachment): attachment is Extract<ResolvedAttachment, { kind: "file" }> => attachment.kind === "file")
      .map((attachment) => ({
        mediaType: attachment.mediaType,
        data: attachment.data,
        filename: attachment.fileName,
      }))
    const useUrlContext = allAttachments.some((attachment) => attachment.kind === "url")

    try {
      const result = await generatePost({
        prompt,
        fileParts,
        useUrlContext,
        model: resolvedModel.selection,
      })
      content = result.content

      // The gateway can silently fall back onto this app's own credentials
      // when a user's key fails (see didFallBackOffByok). Flag the model so
      // Connections tells them to replace the key, instead of it quietly
      // costing us on every future run. Non-fatal in both directions: the
      // post below still saves, and a failed flag write changes nothing.
      if (resolvedModel.modelRowId && (await didFallBackOffByok(result.generationId))) {
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
    } catch (error) {
      // Still surfaces batchContextId even on failure — the context was
      // already resolved (and, on a miss, cached) above this point, so a
      // later call in the same batch (e.g. the model rate-limited this one
      // but not the next) can still reuse it rather than re-resolving too.
      return {
        error: "Couldn't generate that post. Please try again.",
        reason: classifyGenerationError(error),
        batchContextId,
      }
    }
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      project_id: parsed.data.projectId,
      user_id: user.id,
      platform: parsed.data.platform,
      status: parsed.data.scheduledFor ? "scheduled" : "draft",
      content,
      topics: topic ? [topic] : [],
      scheduled_for: parsed.data.scheduledFor,
    })
    .select("id, project_id, platform, status, content, topics, scheduled_for, created_at")
    .single()

  if (error || !data) {
    return { error: "Couldn't save that post. Please try again.", reason: "unknown" }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/generate`)

  return { ok: true, post: mapRow(data), batchContextId }
}

const updatePostSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
  patch: z.object({
    platform: z.enum(["linkedin", "x"]).optional(),
    status: z.enum(["draft", "scheduled", "published"]).optional(),
    scheduledFor: z.string().datetime().nullable().optional(),
    content: z.string().trim().min(1).optional(),
  }),
})

export async function updatePost(
  input: z.infer<typeof updatePostSchema>
): Promise<{ error: string } | { ok: true }> {
  const parsed = updatePostSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't save your changes." }
  }

  const supabase = await createClient()
  const auth = await requireUser(supabase)
  if (!auth.user) {
    return { error: auth.offline ? NETWORK_ERROR_MESSAGE : "You need to be signed in." }
  }

  const { patch } = parsed.data
  const update: {
    platform?: PostPlatform
    status?: PostStatus
    scheduled_for?: string | null
    content?: string
  } = {}
  if (patch.platform !== undefined) update.platform = patch.platform
  if (patch.status !== undefined) update.status = patch.status
  if (patch.scheduledFor !== undefined) update.scheduled_for = patch.scheduledFor
  if (patch.content !== undefined) update.content = patch.content

  const { error } = await supabase.from("posts").update(update).eq("id", parsed.data.id)

  if (error) {
    return { error: "Couldn't save your changes. Please try again." }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/generate`)

  return { ok: true }
}

const deletePostSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
})

export async function deletePost(
  input: z.infer<typeof deletePostSchema>
): Promise<{ error: string } | { ok: true }> {
  const parsed = deletePostSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't delete that post." }
  }

  const supabase = await createClient()
  const auth = await requireUser(supabase)
  if (!auth.user) {
    return { error: auth.offline ? NETWORK_ERROR_MESSAGE : "You need to be signed in." }
  }

  const { error } = await supabase.from("posts").delete().eq("id", parsed.data.id)

  if (error) {
    return { error: "Couldn't delete that post. Please try again." }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/generate`)

  return { ok: true }
}
