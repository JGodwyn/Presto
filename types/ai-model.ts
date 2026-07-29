// The single definition of a user-added AI model — every page reads and
// writes through this type (see AGENTS.md "Shared data shapes"). Maps to
// public.user_ai_models (many rows per *user*, not per project — an API key
// belongs to the person, so a model added once is usable in every project);
// snake_case column names are converted at the query layer
// (lib/supabase/queries.ts), never in pages.
//
// Note what's deliberately absent: the encrypted key itself. It never leaves
// the server — the UI only ever gets keyLastFour.

export type UserAiModelStatus = "active" | "error"

export interface UserAiModel {
  id: string
  // What the user calls it, shown in the Generate page's model pill.
  label: string
  // AI Gateway provider slug, e.g. "google" — the part before the slash in
  // gatewayModelId, kept separately because it's also the key the credential
  // is passed under in providerOptions.gateway.byok.
  providerSlug: string
  // Full gateway model id, e.g. "google/gemini-3.6-flash".
  gatewayModelId: string
  keyLastFour: string
  // "error" means a generation was found to have fallen back off this key
  // onto the app's own gateway credentials — the key needs replacing.
  status: UserAiModelStatus
  lastError: string | null
  createdAt: string
}
