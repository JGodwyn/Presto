import type { SupabaseClient } from "@supabase/supabase-js"

import { extractFileText } from "@/lib/ai/extract-file-text"
import { fetchUrlText } from "@/lib/ai/fetch-url"

// A resolved WritingStyle/ContentReference entry, ready for the prompt
// builder — both tables share this exact shape (kind/content/fileName/
// filePath), so one resolver works for either. "text"/"url" need no I/O
// (content already holds the text or the URL); "file" needs a Storage
// download + base64 encode, which is why this is async and lives apart from
// the otherwise-pure lib/ai/build-prompt.ts.
export type ResolvedAttachment =
  | { kind: "text"; text: string }
  // `text` is the fetched page content, or null when it couldn't be read.
  // Fetching happens here rather than at the model, so every provider gets
  // identical content — see lib/ai/fetch-url.ts.
  | { kind: "url"; url: string; text: string | null }
  // `text` is the extracted document text, or null when it couldn't be read.
  // Extraction happens here rather than at the model, for the same reason as
  // "url" above — see lib/ai/extract-file-text.ts.
  | { kind: "file"; fileName: string; text: string | null }

const FILE_MEDIA_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
}

// Returns null (skip this entry, don't fail the whole generation) for a
// "file" kind with an unrecognized extension or a Storage download error —
// writing style/reference entries are supplementary context, not required
// for generation to proceed.
export async function resolveAttachment(
  supabase: SupabaseClient,
  bucket: string,
  entry: {
    kind: "text" | "url" | "file"
    content: string | null
    fileName: string | null
    filePath: string | null
  }
): Promise<ResolvedAttachment | null> {
  if (entry.kind === "text") {
    return entry.content ? { kind: "text", text: entry.content } : null
  }

  if (entry.kind === "url") {
    if (!entry.content) return null
    return { kind: "url", url: entry.content, text: await fetchUrlText(entry.content) }
  }

  if (!entry.fileName || !entry.filePath) return null

  const extension = entry.fileName.split(".").pop()?.toLowerCase() ?? ""
  const mediaType = FILE_MEDIA_TYPES[extension]

  // A stored file in a format we can no longer read — a legacy .doc, uploaded
  // before that extension was dropped — is reported as unreadable rather than
  // dropped. Returning null here would remove it from the prompt entirely while
  // it still sat in Instructions looking like it was feeding the model, and
  // silently contributing nothing is the one outcome worth ruling out. The
  // prompt says so explicitly instead (see build-prompt.ts's "file" branch).
  //
  // There are no such rows today — checked both tables at the time this was
  // written — so this is about the shape being safe, not a live migration.
  if (!mediaType) return { kind: "file", fileName: entry.fileName, text: null }

  const { data, error } = await supabase.storage.from(bucket).download(entry.filePath)
  if (error || !data) return { kind: "file", fileName: entry.fileName, text: null }

  const bytes = await data.arrayBuffer()
  return {
    kind: "file",
    fileName: entry.fileName,
    text: await extractFileText(mediaType, bytes),
  }
}
