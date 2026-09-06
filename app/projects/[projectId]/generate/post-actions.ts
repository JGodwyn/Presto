"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import {
  resolveAttachment,
  type ResolvedAttachment,
} from "@/lib/ai/attachments"
import { buildPostPrompt, pickTopicForIndex } from "@/lib/ai/build-prompt"
import { type GenerationFailureReason } from "@/lib/ai/model-constants"
import { classifyGenerationError, generatePost, type ModelSelection } from "@/lib/ai/generate"
import { resolveModelSelection, type ResolvedModel } from "@/lib/ai/resolve-model"
import { pickDifferentTasteTestContent, pickTasteTestContent } from "@/lib/ai/taste-test"
import {
  fetchBatchContext,
  fetchContentReferences,
  fetchInstructions,
  fetchWritingStyles,
  mapPostRow,
  POST_COLUMNS,
  type PostRow,
} from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"
import { isNetworkError, NETWORK_ERROR_MESSAGE } from "@/lib/network-error"
import { isPostLocked, UNLOCKED_PUBLISH_ERROR_FILTER } from "@/lib/post-publish"
import type { Post, PostPlatform, PostStatus } from "@/types/post"

const WRITING_STYLE_FILES_BUCKET = "writing-style-files"
const CONTENT_REFERENCE_FILES_BUCKET = "content-reference-files"


// Returns the user, or which *kind* of no-user this is. getUser() yields no
// user both when the session is genuinely gone and when the auth server
// couldn't be reached, and the two deserve different messages — "you've been
// signed out" sends someone off to log in again over what was a dropped
// connection.
export async function requireUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  if (data.user) return { user: data.user } as const
  return {
    user: null,
    offline: Boolean(error && isNetworkError(error)),
  } as const
}

// The resolved writing-style/reference attachments a prompt gets built from,
// plus whichever batch-context row id the *next* call in this batch should
// pass back (see the schema's batchContextId note below). Shared by
// generateAndSavePost and regeneratePost — a regeneration is the same brief
// as the post it replaces, so it resolves its context exactly the same way,
// cache included.
interface GenerationContext {
  writingStyles: ResolvedAttachment[]
  references: ResolvedAttachment[]
  batchContextId: string | undefined
}

export async function resolveGenerationContext(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  batchContextId: string | undefined
): Promise<GenerationContext> {
  // Cache hit: a single cheap row lookup, no Storage I/O, no DB writes.
  // Any failure here (thrown error or a miss — expired, manually deleted,
  // or no id passed at all) falls through to a fresh resolve below rather
  // than surfacing as a generation failure — this cache is purely
  // additive, never a hard dependency for a post to generate.
  if (batchContextId) {
    try {
      const cached = await fetchBatchContext(supabase, projectId, batchContextId)
      if (cached) {
        return {
          writingStyles: cached.writingStyles,
          references: cached.contentReferences,
          batchContextId,
        }
      }
    } catch {
      // Falls through to the fresh resolve below.
    }
  }

  const [writingStyleEntries, referenceEntries] = await Promise.all([
    fetchWritingStyles(supabase, projectId),
    fetchContentReferences(supabase, projectId),
  ])
  const writingStyles = (
    await Promise.all(
      writingStyleEntries.map((entry) => resolveAttachment(supabase, WRITING_STYLE_FILES_BUCKET, entry))
    )
  ).filter((attachment): attachment is ResolvedAttachment => attachment !== null)
  const references = (
    await Promise.all(
      referenceEntries.map((entry) => resolveAttachment(supabase, CONTENT_REFERENCE_FILES_BUCKET, entry))
    )
  ).filter((attachment): attachment is ResolvedAttachment => attachment !== null)

  // No cache row to reuse — this call pays the real resolve cost, same
  // as every call did before this cache existed. Best-effort sweep +
  // insert so the REST of this batch can reuse the result instead of
  // paying it again: neither is allowed to fail this post's generation,
  // so the returned id simply stays unset on any error here, which just
  // means the next call in the batch takes this same miss path too —
  // i.e. the batch degrades to exactly its pre-cache behavior, never a
  // harder failure.
  let freshContextId: string | undefined

  try {
    await supabase
      .from("generation_batch_context")
      .delete()
      .eq("user_id", userId)
      .lt("expires_at", new Date().toISOString())
  } catch {
    // Non-fatal — the insert below is still attempted.
  }

  try {
    const { data: cacheRow, error: cacheError } = await supabase
      .from("generation_batch_context")
      .insert({
        project_id: projectId,
        user_id: userId,
        writing_styles: writingStyles,
        content_references: references,
      })
      .select("id")
      .single()

    if (!cacheError && cacheRow) {
      freshContextId = cacheRow.id
    }
  } catch {
    // Non-fatal — freshContextId stays undefined.
  }

  return { writingStyles, references, batchContextId: freshContextId }
}

// Turns a built prompt + its attachments into generated text. Throws whatever
// generatePost threw (callers run it through classifyGenerationError) — the
// only thing swallowed here is the BYOK-fallback bookkeeping, which must never
// fail a generation that otherwise succeeded.
// Attachments no longer reach the model separately: lib/ai/attachments.ts
// resolves text, URLs and documents all to text, and buildPostPrompt has
// already folded them into `prompt` by the time this runs. There is likewise
// no BYOK-fallback bookkeeping — a direct provider call can't silently run on
// our credentials, so there is nothing to detect afterwards.
async function runGeneration(
  resolvedModel: Extract<ResolvedModel, { selection: ModelSelection }>,
  prompt: string
): Promise<string> {
  const result = await generatePost({ prompt, model: resolvedModel.selection })
  return result.content
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
  // { offset: true } — see updatePostSchema below for why a bare
  // z.string().datetime() is wrong for this app.
  scheduledFor: z.string().datetime({ offset: true }).nullable(),
  // Carries the resolved writing-style/reference context across the calls in
  // one batch run (generating-view.tsx's loop calls this once per post) so
  // it only gets resolved — including any Storage file downloads — once
  // instead of once per post. See the cache-aware branch below; entirely
  // optional and best-effort, never a hard dependency for generation to
  // succeed (see WRITING_STYLE_FILES_BUCKET usage below for why).
  batchContextId: z.string().uuid().optional(),
  // Whether the Generate page's account pill was on "Try out" rather than a
  // real connected account. `platform` below still carries a real value
  // either way — a post has to be written for somewhere — so this is what
  // keeps a stand-in post from later rendering under the user's actual
  // account name. Optional so an older client (or a URL missing the param)
  // still generates, defaulting to a real post.
  isTryout: z.boolean().optional(),
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
    const context = await resolveGenerationContext(
      supabase,
      parsed.data.projectId,
      user.id,
      batchContextId
    )
    batchContextId = context.batchContextId

    const prompt = buildPostPrompt(instructions, {
      platform: parsed.data.platform,
      topic,
      batchContext: { index: parsed.data.batchIndex, total: parsed.data.batchTotal },
      writingStyles: context.writingStyles,
      references: context.references,
    })

    try {
      content = await runGeneration(resolvedModel, prompt)
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
      is_tryout: parsed.data.isTryout ?? false,
    })
    .select(POST_COLUMNS)
    .single()

  if (error || !data) {
    return { error: "Couldn't save that post. Please try again.", reason: "unknown" }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/generate`)

  return { ok: true, post: mapPostRow(data), batchContextId }
}

const regeneratePostSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
  model: z.string().min(1).max(200),
  batchContextId: z.string().uuid().optional(),
  // RegenerateModal's own optional note (design-sync/regeneratemodal) — on
  // top of, not instead of, the project's Instructions (see buildPostPrompt).
  guidance: z.string().trim().max(500).optional(),
  // See the identical field on /api/regenerate-post: the platform to write
  // *for* when it differs from the one the row is on, used only by the
  // too-long-to-switch flow. Prompt input only — this action never writes
  // `platform`.
  targetPlatform: z.enum(["linkedin", "x"]).optional(),
})

// The Regenerate button on a generated card: same prompt builder, same
// Instructions, same writing-style/reference context as the post it replaces —
// only the content changes, in place. Deliberately an UPDATE rather than a
// delete-and-insert, so the post keeps its id (the card is keyed on it), its
// scheduled date and its platform; nothing about where it sits in the batch
// moves because its text was rerolled.
//
// Everything the prompt needs comes from the *stored* row rather than the
// client: platform and topic can both have been changed on the card since it
// was generated, and the row is the only thing that actually knows the current
// values. The client only says which post and which model.
export async function regeneratePost(
  input: z.infer<typeof regeneratePostSchema>
): Promise<
  | { error: string; reason: GenerationFailureReason; batchContextId?: string }
  | { ok: true; post: Post; batchContextId?: string }
> {
  const parsed = regeneratePostSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't regenerate that post.", reason: "unknown" }
  }

  const supabase = await createClient()
  const auth = await requireUser(supabase)
  if (!auth.user) {
    return auth.offline
      ? { error: NETWORK_ERROR_MESSAGE, reason: "network" }
      : { error: "You need to be signed in to regenerate posts.", reason: "not_signed_in" }
  }
  const user = auth.user

  // RLS scopes this to the signed-in user, so someone else's post id reads as
  // a post that doesn't exist — same contract as resolveModelSelection.
  const { data: existing, error: fetchError } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("id", parsed.data.id)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle()

  if (fetchError || !existing) {
    return { error: "Couldn't find that post.", reason: "unknown" }
  }

  // A published post is not rewritten — draftFollowUpPost exists for exactly
  // this, and creates a new draft instead. Checked on the server because the
  // UI hiding the control is a courtesy, never a guarantee: this action is
  // reachable directly, and the page's own copy of the post can be stale by the
  // time someone clicks.
  //
  // This check is the *cheap* one: it refuses an already-published post before
  // spending a model call on it. It is not what makes the guarantee hold — the
  // write below is conditional for that, because the post can go out while the
  // model is still generating.
  if (isPostLocked(mapPostRow(existing as PostRow))) {
    return {
      error: "That post has already gone out — draft a follow-up instead.",
      reason: "unknown",
    }
  }

  const instructions = await fetchInstructions(supabase, parsed.data.projectId)
  if (!instructions) {
    return {
      error: "Set up your project's Instructions before generating posts.",
      reason: "missing_instructions",
    }
  }

  const resolvedModel = await resolveModelSelection(supabase, parsed.data.model)
  if (!resolvedModel) {
    return {
      error: "That model isn't available anymore. Pick another one in Connections.",
      reason: "model_unavailable",
    }
  }

  const row = existing as PostRow
  let content: string
  let batchContextId = parsed.data.batchContextId

  if ("kind" in resolvedModel) {
    content = pickDifferentTasteTestContent(row.content)
  } else {
    const context = await resolveGenerationContext(
      supabase,
      parsed.data.projectId,
      user.id,
      batchContextId
    )
    batchContextId = context.batchContextId

    const prompt = buildPostPrompt(instructions, {
      platform: parsed.data.targetPlatform ?? row.platform,
      // Whatever topic this post was generated under (posts store at most
      // one) — so a reroll stays on the same subject rather than drifting to
      // whatever the round-robin would have picked next.
      topic: row.topics[0],
      writingStyles: context.writingStyles,
      references: context.references,
      previousContent: row.content,
      guidance: parsed.data.guidance,
    })

    try {
      content = await runGeneration(resolvedModel, prompt)
    } catch (error) {
      return {
        error: "Couldn't regenerate that post. Please try again.",
        reason: classifyGenerationError(error),
        batchContextId,
      }
    }
  }

  // The lock is re-asserted **on the write**, not merely checked above.
  //
  // The `isPostLocked` guard earlier in this function runs before
  // `runGeneration`, which is a live model call taking seconds — so the check
  // and the write straddle a window wide enough for the scheduler to publish
  // this very post in between. Re-reading would not help; only the update
  // itself can be conditional. If the row went out while the model was
  // thinking, no row comes back and nothing is overwritten.
  //
  // `project_id` is here for the same reason it is on every sibling: RLS scopes
  // to the caller, but one person owns several projects, so `id` alone would
  // let one project's page rewrite another's post.
  const { data, error } = await supabase
    .from("posts")
    .update({ content })
    .eq("id", parsed.data.id)
    .eq("project_id", parsed.data.projectId)
    .is("published_at", null)
    .or(UNLOCKED_PUBLISH_ERROR_FILTER)
    .select(POST_COLUMNS)
    .maybeSingle()

  if (error) {
    return { error: "Couldn't save the new post. Please try again.", reason: "unknown" }
  }

  // No row means the post went out while the model was generating — the
  // generation is discarded rather than written over something already public.
  if (!data) {
    return {
      error: "That post went out while it was being rewritten, so the new version wasn't saved.",
      reason: "unknown",
    }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/generate`)

  return { ok: true, post: mapPostRow(data), batchContextId }
}

const draftFollowUpPostSchema = z.object({
  projectId: z.string().uuid(),
  // The published post to riff on.
  id: z.string().uuid(),
})

// Regenerate, on a post that has already gone out.
//
// **It must not rewrite the source**, which is the whole reason this exists
// beside `regeneratePost` rather than inside it: the live post is on someone's
// timeline and this app cannot change or recall it, so an in-place UPDATE
// would only make the row and the real post disagree. So this INSERTs a *new
// draft* instead — a piece that landed well is exactly the one worth writing
// another angle on, and a draft is the state where that is still editable,
// re-datable and cancellable.
//
// **It does not generate anything, and that is deliberate.** The row has to
// exist before the user can be taken to it, and taking them to it is the whole
// point: the generation then streams onto the draft's own page through
// /api/regenerate-post, the same path an ordinary reroll uses, so they watch it
// being written instead of watching a spinner on the button they just pressed.
// This call is therefore a cheap insert and returns in milliseconds.
//
// **The draft is seeded with the published text.** `posts.content` cannot be
// empty, and of the things that satisfy that, the post being followed up is the
// only one that is useful if the generation never lands: the draft is then a
// copy to edit rather than a placeholder to delete. In the ordinary path it is
// never seen — the draft's page blanks the body the moment the stream starts.
//
// **Refuses anything that is not live.** This is the published path and only
// the published path; an unpublished post has `regeneratePost`, which rewrites
// in place. Keeping the guard here means this can never become a quiet second
// way to duplicate arbitrary posts.
export async function draftFollowUpPost(
  input: z.infer<typeof draftFollowUpPostSchema>
): Promise<{ error: string; reason: GenerationFailureReason } | { ok: true; post: Post }> {
  const parsed = draftFollowUpPostSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't start a new draft.", reason: "unknown" }
  }

  const supabase = await createClient()
  const auth = await requireUser(supabase)
  if (!auth.user) {
    return auth.offline
      ? { error: NETWORK_ERROR_MESSAGE, reason: "network" }
      : { error: "You need to be signed in to generate posts.", reason: "not_signed_in" }
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
    return { error: "Couldn't find that post.", reason: "unknown" }
  }

  const source = mapPostRow(existing as PostRow)

  // The same predicate the three surfaces use to decide the control is even
  // offered (lib/post-publish.ts) — asked again here because a client
  // predicate is a courtesy, never a guarantee.
  if (!isPostLocked(source)) {
    return {
      error: "That post hasn't gone out yet — regenerate it instead.",
      reason: "unknown",
    }
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      project_id: parsed.data.projectId,
      user_id: user.id,
      platform: source.platform,
      status: "draft",
      content: source.content,
      topics: source.topics,
      scheduled_for: null,
      is_tryout: source.isTryout,
    })
    .select(POST_COLUMNS)
    .single()

  if (error || !data) {
    return { error: "Couldn't start a new draft. Please try again.", reason: "unknown" }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/calendar`)

  return { ok: true, post: mapPostRow(data) }
}

const updatePostSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
  patch: z.object({
    platform: z.enum(["linkedin", "x"]).optional(),
    status: z.enum(["draft", "scheduled", "published"]).optional(),
    // { offset: true }, not a bare z.string().datetime(): Zod's default only
    // accepts a 'Z'-suffixed UTC string, but Postgres/PostgREST always
    // serializes timestamptz with an explicit numeric offset instead (e.g.
    // "2026-07-31T23:00:00+00:00" — confirmed directly against this
    // project's DB). A freshly-built `date.toISOString()` (handleDateChange)
    // is always 'Z' and passed either way, but a value round-tripped from a
    // server-fetched post — e.g. post-details.tsx's Undo, which resends the
    // pre-move scheduledFor it already had in state — carries the DB's own
    // offset format and was failing this parse every time, silently
    // reported to the user as "Couldn't restore that post."
    scheduledFor: z.string().datetime({ offset: true }).nullable().optional(),
    content: z.string().trim().min(1).optional(),
    // Switching a post onto (or off) the "Try out" stand-in account. Paired
    // with `platform` at every call site rather than replacing it: a try-out
    // post still carries a real platform, so the two travel together.
    isTryout: z.boolean().optional(),
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
    is_tryout?: boolean
  } = {}
  if (patch.platform !== undefined) update.platform = patch.platform
  if (patch.status !== undefined) update.status = patch.status
  if (patch.scheduledFor !== undefined) update.scheduled_for = patch.scheduledFor
  if (patch.content !== undefined) update.content = patch.content
  if (patch.isTryout !== undefined) update.is_tryout = patch.isTryout

  // Scoped to the project as well as the id, like its siblings. RLS scopes to
  // the caller's own rows, but one person owns several projects, so `id` alone
  // would let project B's page edit project A's post.
  //
  // The lock is part of the statement rather than a check before it: a
  // published post must not be rewritten, and the details page holds a
  // load-time snapshot — so if the scheduler publishes while that page is open,
  // a fetch-then-update would still see an unpublished row and overwrite
  // content that is already live. Here the database decides, and `.select()`
  // reports whether anything actually matched.
  const { data: updated, error } = await supabase
    .from("posts")
    .update(update)
    .eq("id", parsed.data.id)
    .eq("project_id", parsed.data.projectId)
    .is("published_at", null)
    .or(UNLOCKED_PUBLISH_ERROR_FILTER)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: "Couldn't save your changes. Please try again." }
  }

  // Nothing matched: the post is gone, or it has gone out. Told apart with a
  // second read so a published post gets an answer that explains itself rather
  // than "couldn't save".
  if (!updated) {
    const { data: existing } = await supabase
      .from("posts")
      .select("published_at, publish_error")
      .eq("id", parsed.data.id)
      .eq("project_id", parsed.data.projectId)
      .maybeSingle()

    if (
      existing &&
      isPostLocked({
        publishedAt: existing.published_at,
        publishError: existing.publish_error,
      })
    ) {
      return {
        error: "That post has already gone out, so it can't be changed.",
      }
    }

    return { error: "Couldn't save your changes. Please try again." }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/generate`)
  revalidatePath(`/projects/${parsed.data.projectId}/calendar`)

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
  revalidatePath(`/projects/${parsed.data.projectId}/calendar`)

  return { ok: true }
}
