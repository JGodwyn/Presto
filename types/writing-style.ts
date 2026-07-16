// The single definition of a writing-style entry — every page reads and
// writes through this type (see AGENTS.md "Shared data shapes"). Maps to
// public.writing_styles (many rows per project); snake_case column names are
// converted at the query layer (lib/supabase/queries.ts), never in pages.

export type WritingStyleKind = "text" | "url" | "file"

export interface WritingStyle {
  id: string
  projectId: string
  kind: WritingStyleKind
  // Holds the body text or the URL for "text"/"url" kinds; null for "file".
  content: string | null
  fileName: string | null
  fileSize: number | null
  filePath: string | null
  createdAt: string
}
