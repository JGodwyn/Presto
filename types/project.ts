// The single definition of what a project looks like — every page reads and
// writes through this type (see AGENTS.md "Shared data shapes"). Maps to the
// public.projects table; snake_case column names are converted at the query
// layer (lib/supabase/queries.ts), never in pages.

export interface Project {
  id: string
  name: string
  createdAt: string
}
