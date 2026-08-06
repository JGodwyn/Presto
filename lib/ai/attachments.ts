import type { SupabaseClient } from "@supabase/supabase-js"

// A resolved WritingStyle/ContentReference entry, ready for the prompt
// builder — both tables share this exact shape (kind/content/fileName/
// filePath), so one resolver works for either. "text"/"url" need no I/O
// (content already holds the text or the URL); "file" needs a Storage
// download + base64 encode, which is why this is async and lives apart from
// the otherwise-pure lib/ai/build-prompt.ts.
export type ResolvedAttachment =
  | { kind: "text"; text: string }
  | { kind: "url"; url: string }
  | { kind: "file"; fileName: string; mediaType: string; data: string }

const FILE_MEDIA_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
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
    return entry.content ? { kind: "url", url: entry.content } : null
  }

  if (!entry.fileName || !entry.filePath) return null

  const extension = entry.fileName.split(".").pop()?.toLowerCase() ?? ""
  const mediaType = FILE_MEDIA_TYPES[extension]
  if (!mediaType) return null

  const { data, error } = await supabase.storage.from(bucket).download(entry.filePath)
  if (error || !data) return null

  const bytes = await data.arrayBuffer()
  return {
    kind: "file",
    fileName: entry.fileName,
    mediaType,
    data: Buffer.from(bytes).toString("base64"),
  }
}

// Turns a resolved attachment list into the two things generatePost/streamPost
// actually need: the file parts to send inline, and whether the prompt
// mentions a URL the model should fetch itself (google.tools.urlContext(),
// wired in lib/ai/generate.ts). Shared by post-actions.ts's runGeneration and
// the streaming regenerate route so both derive it the same way.
export function resolveAttachmentInputs(attachments: ResolvedAttachment[]): {
  fileParts: { mediaType: string; data: string; filename?: string }[]
  useUrlContext: boolean
} {
  return {
    fileParts: attachments
      .filter((attachment): attachment is Extract<ResolvedAttachment, { kind: "file" }> => attachment.kind === "file")
      .map((attachment) => ({
        mediaType: attachment.mediaType,
        data: attachment.data,
        filename: attachment.fileName,
      })),
    useUrlContext: attachments.some((attachment) => attachment.kind === "url"),
  }
}
