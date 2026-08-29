import type { GenerationFailureReason } from "@/lib/ai/generate"

// A toast's two lines: the headline and the small capsule under it
// (components/ui/toast.tsx's `extraInfo`).
export interface GenerationFailureCopy {
  message: string
  extraInfo?: string
}

// Reasons worth naming outright rather than reporting as "couldn't do that".
// A 429 is the one the model explains in terms the user can act on — their own
// quota, on their own key — and "we couldn't regenerate this post" hides that
// behind what reads as our failure. Every other reason keeps the call site's
// own wording, so this stays the exception rather than a second copy deck to
// keep in step with TOTAL_FAILURE_MESSAGES (generating-view.tsx), which says
// the same things at the length that screen has room for.
const NAMED_FAILURES: Partial<
  Record<GenerationFailureReason, GenerationFailureCopy>
> = {
  rate_limit: {
    message: "You exceeded your model quota",
    extraInfo: "Try again later",
  },
}

/**
 * The copy for a failed generation, given what classifyGenerationError made of
 * it. `fallback` is the call site's own generic line, used for every reason
 * this doesn't name — so a reason it has never heard of (one arriving as a
 * plain string off the regenerate stream, say) can't produce an empty toast.
 */
export function generationFailureCopy(
  reason: string | undefined,
  fallback: GenerationFailureCopy
): GenerationFailureCopy {
  if (!reason) return fallback
  return NAMED_FAILURES[reason as GenerationFailureReason] ?? fallback
}
