"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { buildPostPrompt, pickTopicForIndex } from "@/lib/ai/build-prompt"
import {
  classifyGenerationError,
  generatePost,
  GENERATION_MODELS,
  type GenerationFailureReason,
} from "@/lib/ai/generate"
import { pickTasteTestContent } from "@/lib/ai/taste-test"
import { fetchInstructions } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"
import type { Post, PostPlatform, PostStatus } from "@/types/post"

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

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

const generateAndSavePostSchema = z.object({
  projectId: z.string().uuid(),
  platform: z.enum(["linkedin", "x"]),
  model: z.enum(GENERATION_MODELS),
  batchIndex: z.number().int().min(0),
  batchTotal: z.number().int().min(1),
  scheduledFor: z.string().datetime().nullable(),
})

export async function generateAndSavePost(
  input: z.infer<typeof generateAndSavePostSchema>
): Promise<{ error: string; reason: GenerationFailureReason } | { ok: true; post: Post }> {
  const parsed = generateAndSavePostSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't generate that post.", reason: "unknown" }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to generate posts.", reason: "not_signed_in" }
  }

  const instructions = await fetchInstructions(supabase, parsed.data.projectId)
  if (!instructions) {
    return {
      error: "Set up your project's Instructions before generating posts.",
      reason: "missing_instructions",
    }
  }

  const topic = pickTopicForIndex(instructions.topics, parsed.data.batchIndex)

  // TasteTest skips the real model call entirely (no prompt needed) so the
  // Generate flow's UI — reveal pacing, topic assignment, persistence,
  // review/edit actions — can be exercised for free. Everything else below
  // (the DB row, topics, scheduling) runs exactly as it does for a real
  // model.
  let content: string
  if (parsed.data.model === "tastetest") {
    content = pickTasteTestContent(parsed.data.batchIndex)
  } else {
    const prompt = buildPostPrompt(instructions, {
      platform: parsed.data.platform,
      topic,
      batchContext: { index: parsed.data.batchIndex, total: parsed.data.batchTotal },
    })

    try {
      content = (await generatePost({ prompt })).content
    } catch (error) {
      return {
        error: "Couldn't generate that post. Please try again.",
        reason: classifyGenerationError(error),
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

  return { ok: true, post: mapRow(data) }
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
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in." }
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
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in." }
  }

  const { error } = await supabase.from("posts").delete().eq("id", parsed.data.id)

  if (error) {
    return { error: "Couldn't delete that post. Please try again." }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/generate`)

  return { ok: true }
}
