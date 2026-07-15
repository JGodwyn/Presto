"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

// Length caps mirror the check constraints on public.instructions.
const saveInstructionsSchema = z.object({
  projectId: z.string().uuid(),
  singlePrompt: z.boolean(),
  singlePromptText: z.string().max(20000),
  tone: z.string().max(5000),
  contentRules: z.string().max(5000),
  postStructure: z.string().max(5000),
  whatToAvoid: z.string().max(5000),
  topics: z.array(z.string().trim().min(1).max(80)).max(100),
})

export type SaveInstructionsInput = z.infer<typeof saveInstructionsSchema>

// Blur-triggered auto-save from the My voice card — there's no save button
// anywhere in the design, so this runs on every field exit and toggle flip
// and stays a cheap single-row upsert. Ownership is enforced by RLS: the
// insert policy on public.instructions checks the project belongs to the
// caller, and updates only ever see the caller's own row.
export async function saveInstructions(
  input: SaveInstructionsInput
): Promise<{ error: string } | { ok: true }> {
  const parsed = saveInstructionsSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Couldn't save — one of the fields is too long." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You need to be signed in to save instructions." }
  }

  const { projectId, ...fields } = parsed.data

  const { error } = await supabase.from("instructions").upsert({
    project_id: projectId,
    user_id: user.id,
    single_prompt: fields.singlePrompt,
    single_prompt_text: fields.singlePromptText,
    tone: fields.tone,
    content_rules: fields.contentRules,
    post_structure: fields.postStructure,
    what_to_avoid: fields.whatToAvoid,
    topics: fields.topics,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    return { error: "Couldn't save your changes. Please try again." }
  }

  // Keeps the page's server prefill in step with what was just saved if the
  // user navigates away and back within the client router cache's lifetime.
  revalidatePath(`/projects/${projectId}/instructions`)

  return { ok: true }
}
