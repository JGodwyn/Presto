// A regeneration that was asked for on one screen and has to run on another.
//
// Regenerating a published post writes a *new draft* rather than touching the
// live one, and the request is made from the published post — its own page, or
// its card in the day deck — while the generation belongs on the draft that
// comes out of it. So the brief picked in the modal (the note, the model, the
// topic) has to survive one client navigation.
//
// **A module-level store, not sessionStorage and not a query string.** The two
// alternatives are both worse here: a query string would put the user's own
// free-text guidance in the URL, where it is logged and shareable, and
// sessionStorage is a synchronous disk write for something that only ever needs
// to outlive a `router.push`. A module lives exactly as long as the tab's JS
// does, which is precisely the lifetime this needs — the same reasoning as
// lib/section-navigation.ts and hooks/use-scroll-memory.ts.
//
// **It degrades to nothing, on purpose.** A hard reload (or arriving at the
// draft any other way) empties the store, so the page simply shows the draft it
// was given and regenerates nothing. That is the safe direction: a lost handoff
// costs one click to redo, where a persisted one could re-fire a generation on
// a post the user only meant to open.

export interface PendingRegeneration {
  // The modal's own optional note. Empty string when it was left blank.
  guidance: string
  // A built-in id or a user_ai_models row id, already resolved by the modal.
  model: string
  // Undefined when the project has no topics and the post carries none.
  topic: string | undefined
}

// Keyed by the post the regeneration is *for* — the new draft, not the
// published post it came from. Two follow-ups drafted in quick succession are
// two different ids, so neither can consume the other's brief.
const pending = new Map<string, PendingRegeneration>()

export function setPendingRegeneration(
  postId: string,
  request: PendingRegeneration
): void {
  pending.set(postId, request)
}

// Consume-once: reading it removes it, so a re-render, a back-navigation or a
// second mount of the same page cannot start the generation twice. The caller
// gets one shot, which is the only number of shots that is ever correct here.
export function takePendingRegeneration(
  postId: string
): PendingRegeneration | null {
  const request = pending.get(postId)
  if (!request) return null
  pending.delete(postId)
  return request
}
