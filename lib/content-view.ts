import { CONTENT_TABS, type ContentTab } from "@/lib/content-grouping"

// How the Content page lays out a day's posts. Kanban is first, which makes it
// the default (design-sync/content-kanban-view); tapping "Show as" cycles
// through this list in order. A List view has been mentioned but not exported
// — adding it is one entry here.
export const CONTENT_VIEWS = [
  { value: "kanban", label: "Kanban" },
  { value: "calendar", label: "Calendar" },
] as const

export type ContentViewMode = (typeof CONTENT_VIEWS)[number]["value"]

export const DEFAULT_CONTENT_VIEW: ContentViewMode = CONTENT_VIEWS[0].value

export const DEFAULT_CONTENT_TAB: ContentTab = CONTENT_TABS[0].value

// The choice is remembered per project, matching how the Generate page
// remembers its own form (lib/generate-settings.ts) — the same kind of
// "remember what I picked here" preference, so one convention covers both.
//
// Read through useSyncExternalStore rather than an effect that copies
// localStorage into state: localStorage doesn't exist on the server, and this
// is exactly the "external store with a server snapshot" case that hook is
// for. Same shape as lib/network-status.ts and lib/section-navigation.ts.
const listeners = new Set<() => void>()

function storageKey(projectId: string): string {
  return `presto:content-view:${projectId}`
}

export function subscribeToContentView(onChange: () => void): () => void {
  listeners.add(onChange)
  // A change in another tab counts too; the same tab is covered by setContentView
  // below, since `storage` deliberately doesn't fire on the window that wrote.
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

// Falls back to the default for anything unusable — nothing saved, or a value
// that isn't one of the current views (a stale entry from a renamed or removed
// layout). Returns a string, so repeated calls are value-equal and the hook
// has no reason to re-render.
export function getContentView(projectId: string): ContentViewMode {
  try {
    const stored = window.localStorage.getItem(storageKey(projectId))
    return CONTENT_VIEWS.some((view) => view.value === stored)
      ? (stored as ContentViewMode)
      : DEFAULT_CONTENT_VIEW
  } catch {
    return DEFAULT_CONTENT_VIEW
  }
}

// What the server renders, before any stored choice is known.
export function getServerContentView(): ContentViewMode {
  return DEFAULT_CONTENT_VIEW
}

export function setContentView(projectId: string, view: ContentViewMode) {
  try {
    window.localStorage.setItem(storageKey(projectId), view)
  } catch {
    // Private mode, a full quota — the page still switches, it just won't
    // remember next time.
  }
  for (const listener of listeners) listener()
}

// The tab rides along in the same store for the same reason: leaving the
// Content page for a post's own page and coming back used to drop you on
// Queued regardless of where you'd been, because the tab was component state
// and the page remounts. Same read path, same per-project key shape.
function tabStorageKey(projectId: string): string {
  return `presto:content-tab:${projectId}`
}

export function getContentTab(projectId: string): ContentTab {
  try {
    const stored = window.localStorage.getItem(tabStorageKey(projectId))
    return CONTENT_TABS.some((tab) => tab.value === stored)
      ? (stored as ContentTab)
      : DEFAULT_CONTENT_TAB
  } catch {
    return DEFAULT_CONTENT_TAB
  }
}

export function getServerContentTab(): ContentTab {
  return DEFAULT_CONTENT_TAB
}

export function setContentTab(projectId: string, tab: ContentTab) {
  try {
    window.localStorage.setItem(tabStorageKey(projectId), tab)
  } catch {
    // As above — it still switches, it just won't be remembered.
  }
  for (const listener of listeners) listener()
}
