"use server"

import { randomUUID } from "crypto"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import type { WritingStyle, WritingStyleKind } from "@/types/writing-style"

const BUCKET = "writing-style-files"
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_FILE_EXTENSIONS = ["pdf", "doc", "docx", "txt"]

type WritingStyleRow = {
  id: string
  project_id: string
  kind: WritingStyleKind
  content: string | null
  file_name: string | null
  file_size: number | null
  file_path: string | null
  created_at: string
}

function mapRow(row: WritingStyleRow): WritingStyle {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    content: row.content,
    fileName: row.file_name,
    fileSize: row.file_size,
    filePath: row.file_path,
    createdAt: row.created_at,
  }
}

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// Shared by all three "add" actions below — the only thing that differs
// between a text, url, and file entry is which fields are populated.
async function insertWritingStyle(
  supabase: SupabaseClient,
  userId: string,
  fields: {
    projectId: string
    kind: WritingStyleKind
    content?: string | null
    fileName?: string | null
    fileSize?: number | null
    filePath?: string | null
  }
): Promise<{ error: string } | { ok: true; style: WritingStyle }> {
  const { data, error } = await supabase
    .from("writing_styles")
    .insert({
      project_id: fields.projectId,
      user_id: userId,
      kind: fields.kind,
      content: fields.content ?? null,
      file_name: fields.fileName ?? null,
      file_size: fields.fileSize ?? null,
      file_path: fields.filePath ?? null,
    })
    .select("id, project_id, kind, content, file_name, file_size, file_path, created_at")
    .single()

  if (error || !data) {
    return { error: "Couldn't save that writing style. Please try again." }
  }

  revalidatePath(`/projects/${fields.projectId}/instructions`)

  return { ok: true, style: mapRow(data) }
}

const textStyleSchema = z.object({
  projectId: z.string().uuid(),
  content: z.string().trim().min(1).max(20000),
})

export async function addTextWritingStyle(
  input: z.infer<typeof textStyleSchema>
): Promise<{ error: string } | { ok: true; style: WritingStyle }> {
  const parsed = textStyleSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Type out an example before saving." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to add a writing style." }
  }

  return insertWritingStyle(supabase, user.id, {
    projectId: parsed.data.projectId,
    kind: "text",
    content: parsed.data.content,
  })
}

const updateTextStyleSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
  content: z.string().trim().min(1).max(20000),
})

// Text entries are the only editable kind — the writing-style card renders
// them as a live textarea (matching My Voice's "Tone" field); URL and File
// entries stay display-only. Scoped to kind = "text" in the query as a second
// line of defense on top of the UI never offering this for other kinds.
export async function updateTextWritingStyle(
  input: z.infer<typeof updateTextStyleSchema>
): Promise<{ error: string } | { ok: true }> {
  const parsed = updateTextStyleSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't save your changes." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to edit a writing style." }
  }

  const { error } = await supabase
    .from("writing_styles")
    .update({ content: parsed.data.content })
    .eq("id", parsed.data.id)
    .eq("kind", "text")

  if (error) {
    return { error: "Couldn't save your changes. Please try again." }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/instructions`)

  return { ok: true }
}

const urlStyleSchema = z.object({
  projectId: z.string().uuid(),
  content: z.string().trim().min(1).url().max(2048),
})

export async function addUrlWritingStyle(
  input: z.infer<typeof urlStyleSchema>
): Promise<{ error: string } | { ok: true; style: WritingStyle }> {
  const parsed = urlStyleSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Enter a valid URL before saving." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to add a writing style." }
  }

  return insertWritingStyle(supabase, user.id, {
    projectId: parsed.data.projectId,
    kind: "url",
    content: parsed.data.content,
  })
}

const fileStyleSchema = z.object({
  projectId: z.string().uuid(),
})

export async function addFileWritingStyle(
  formData: FormData
): Promise<{ error: string } | { ok: true; style: WritingStyle }> {
  const parsed = fileStyleSchema.safeParse({
    projectId: formData.get("projectId"),
  })
  const file = formData.get("file")

  if (!parsed.success || !(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." }
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    return { error: "Supports PDF, Word, and TXT files only." }
  }

  if (file.size > MAX_FILE_BYTES) {
    return { error: "That file is larger than 10MB." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to add a writing style." }
  }

  const path = `${user.id}/${parsed.data.projectId}/${randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file)

  if (uploadError) {
    return { error: "Couldn't upload that file. Please try again." }
  }

  const result = await insertWritingStyle(supabase, user.id, {
    projectId: parsed.data.projectId,
    kind: "file",
    fileName: file.name,
    fileSize: file.size,
    filePath: path,
  })

  if ("error" in result) {
    await supabase.storage.from(BUCKET).remove([path])
  }

  return result
}

const deleteStyleSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
})

export async function deleteWritingStyle(
  input: z.infer<typeof deleteStyleSchema>
): Promise<{ error: string } | { ok: true }> {
  const parsed = deleteStyleSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't delete that item." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in." }
  }

  // RLS scopes both the read and the delete to rows this user owns — the
  // file_path lookup is just to know whether a Storage object needs cleanup.
  const { data: existing } = await supabase
    .from("writing_styles")
    .select("file_path")
    .eq("id", parsed.data.id)
    .maybeSingle()

  const { error } = await supabase
    .from("writing_styles")
    .delete()
    .eq("id", parsed.data.id)

  if (error) {
    return { error: "Couldn't delete that item. Please try again." }
  }

  if (existing?.file_path) {
    await supabase.storage.from(BUCKET).remove([existing.file_path])
  }

  revalidatePath(`/projects/${parsed.data.projectId}/instructions`)

  return { ok: true }
}
