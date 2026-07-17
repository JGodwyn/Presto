"use server"

import { randomUUID } from "crypto"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import type { ContentReference, ContentReferenceKind } from "@/types/content-reference"

// Mirrors writing-style-actions.ts exactly — References works the same way
// My writing style does, just against public.content_references and its own
// Storage bucket instead.
const BUCKET = "content-reference-files"
// Matches Next's own default Server Actions body-size limit (1024 * 1024) —
// anything at or above this never even reaches this action, so this is a
// defense-in-depth backstop, not the primary check (that's client-side, in
// components/instructions/upload-dropzone.tsx, which is what actually
// surfaces a real message to the user before the request is ever sent).
const MAX_FILE_BYTES = 1024 * 1024
const ALLOWED_FILE_EXTENSIONS = ["pdf", "doc", "docx", "txt"]

type ContentReferenceRow = {
  id: string
  project_id: string
  kind: ContentReferenceKind
  content: string | null
  file_name: string | null
  file_size: number | null
  file_path: string | null
  created_at: string
}

function mapRow(row: ContentReferenceRow): ContentReference {
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
async function insertContentReference(
  supabase: SupabaseClient,
  userId: string,
  fields: {
    projectId: string
    kind: ContentReferenceKind
    content?: string | null
    fileName?: string | null
    fileSize?: number | null
    filePath?: string | null
  }
): Promise<{ error: string } | { ok: true; reference: ContentReference }> {
  const { data, error } = await supabase
    .from("content_references")
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
    return { error: "Couldn't save that reference. Please try again." }
  }

  revalidatePath(`/projects/${fields.projectId}/instructions`)

  return { ok: true, reference: mapRow(data) }
}

const textReferenceSchema = z.object({
  projectId: z.string().uuid(),
  content: z.string().trim().min(1).max(20000),
})

export async function addTextReference(
  input: z.infer<typeof textReferenceSchema>
): Promise<{ error: string } | { ok: true; reference: ContentReference }> {
  const parsed = textReferenceSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Type out some reference material before saving." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to add a reference." }
  }

  return insertContentReference(supabase, user.id, {
    projectId: parsed.data.projectId,
    kind: "text",
    content: parsed.data.content,
  })
}

const updateTextReferenceSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
  content: z.string().trim().min(1).max(20000),
})

// Text entries are the only editable kind — the references card renders them
// as a live textarea (matching My Voice's "Tone" field and writing-style's
// text entries); URL and File entries stay display-only. Scoped to
// kind = "text" in the query as a second line of defense on top of the UI
// never offering this for other kinds.
export async function updateTextReference(
  input: z.infer<typeof updateTextReferenceSchema>
): Promise<{ error: string } | { ok: true }> {
  const parsed = updateTextReferenceSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Couldn't save your changes." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to edit a reference." }
  }

  const { error } = await supabase
    .from("content_references")
    .update({ content: parsed.data.content })
    .eq("id", parsed.data.id)
    .eq("kind", "text")

  if (error) {
    return { error: "Couldn't save your changes. Please try again." }
  }

  revalidatePath(`/projects/${parsed.data.projectId}/instructions`)

  return { ok: true }
}

const urlReferenceSchema = z.object({
  projectId: z.string().uuid(),
  content: z.string().trim().min(1).url().max(2048),
})

export async function addUrlReference(
  input: z.infer<typeof urlReferenceSchema>
): Promise<{ error: string } | { ok: true; reference: ContentReference }> {
  const parsed = urlReferenceSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Enter a valid URL before saving." }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to add a reference." }
  }

  return insertContentReference(supabase, user.id, {
    projectId: parsed.data.projectId,
    kind: "url",
    content: parsed.data.content,
  })
}

const fileReferenceSchema = z.object({
  projectId: z.string().uuid(),
})

export async function addFileReference(
  formData: FormData
): Promise<{ error: string } | { ok: true; reference: ContentReference }> {
  const parsed = fileReferenceSchema.safeParse({
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

  if (file.size >= MAX_FILE_BYTES) {
    return { error: "Keep your files less than 1MB" }
  }

  const supabase = await createClient()
  const user = await requireUser(supabase)
  if (!user) {
    return { error: "You need to be signed in to add a reference." }
  }

  const path = `${user.id}/${parsed.data.projectId}/${randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file)

  if (uploadError) {
    return { error: "Couldn't upload that file. Please try again." }
  }

  const result = await insertContentReference(supabase, user.id, {
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

const deleteReferenceSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
})

export async function deleteReference(
  input: z.infer<typeof deleteReferenceSchema>
): Promise<{ error: string } | { ok: true }> {
  const parsed = deleteReferenceSchema.safeParse(input)
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
    .from("content_references")
    .select("file_path")
    .eq("id", parsed.data.id)
    .maybeSingle()

  const { error } = await supabase
    .from("content_references")
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
