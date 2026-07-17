// The single definition of a content-reference entry — every page reads and
// writes through this type (see AGENTS.md "Shared data shapes"). Maps to
// public.content_references (many rows per project); snake_case column names
// are converted at the query layer (lib/supabase/queries.ts), never in pages.
// Mirrors types/writing-style.ts exactly — References works the same way My
// writing style does, just against a separate table.

export type ContentReferenceKind = "text" | "url" | "file"

export interface ContentReference {
  id: string
  projectId: string
  kind: ContentReferenceKind
  // Holds the body text or the URL for "text"/"url" kinds; null for "file".
  content: string | null
  fileName: string | null
  fileSize: number | null
  filePath: string | null
  createdAt: string
}
