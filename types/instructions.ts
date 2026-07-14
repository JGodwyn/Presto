// The single definition of an instructions set — every page reads and writes
// through this type (see AGENTS.md "Shared data shapes"). Maps to the
// public.instructions table (one row per project); snake_case column names
// are converted at the query layer (lib/supabase/queries.ts), never in pages.

export interface Instructions {
  projectId: string
  singlePrompt: boolean
  singlePromptText: string
  tone: string
  contentRules: string
  postStructure: string
  whatToAvoid: string
  topics: string[]
  updatedAt: string
}
