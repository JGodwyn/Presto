// Where the Generate page parks its own form state between visits
// (components/generate/generate-card.tsx writes the whole shape; everything
// else only ever reads a field or two out of it).
export function generateSettingsStorageKey(projectId: string): string {
  return `presto:generate-settings:${projectId}`
}

// The model the user last generated this project's posts with. Read by any
// screen that regenerates a post without offering its own model picker (the
// Content page's day deck), so a BYOK user's reroll keeps running on their own
// key rather than quietly falling back to the built-in.
//
// Returns null for anything unusable — no saved settings, corrupt JSON, or a
// stored value that isn't a non-empty string — leaving the fallback to the
// caller. A stale id (a model deleted since) is deliberately *not* filtered
// here: it can only be checked against the database, and regeneratePost
// already reports it as "model_unavailable" with copy telling the user what
// to do.
export function readPreferredModel(projectId: string): string | null {
  try {
    const raw = window.localStorage.getItem(generateSettingsStorageKey(projectId))
    if (!raw) return null
    const saved = JSON.parse(raw) as { model?: unknown }
    return typeof saved.model === "string" && saved.model.length > 0
      ? saved.model
      : null
  } catch {
    return null
  }
}
