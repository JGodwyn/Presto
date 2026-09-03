import type { PostPlatform } from "@/types/post"

// How long a post is allowed to be, per platform.
//
// **This lives in its own module, and that placement is load-bearing.** The
// limit is needed by the prompt builder (server) *and* by post cards (client).
// Putting it in lib/ai/build-prompt.ts would mean every card importing it drags
// the prompt builder — and everything it imports — into the client bundle,
// which is the exact trap AGENTS.md documents for lib/ai/generate.ts and
// lib/ai/no-client-sdk.test.ts exists to catch. This file imports nothing but a
// type, so it is free to import from anywhere.
//
// Only X is listed. LinkedIn's own ceiling is 3,000 characters, high enough
// that nothing this app generates approaches it — a counter that never turns
// red is noise on every card, and stating it in the prompt would narrow a
// target that never binds. A platform absent from this map has no limit as far
// as the app is concerned.
//
// **280 is the free-tier number, applied to everyone by decision rather than
// detection.** X Premium allows 25,000, but the API exposes no reliable tier
// signal, and letting someone write a 2,000-character post their account can't
// publish is a worse failure than a Premium user getting a shorter one. If that
// changes it belongs as a per-account setting, not a guess.
export const PLATFORM_LENGTH_LIMITS: Partial<Record<PostPlatform, number>> = {
  x: 280,
}

export interface PostLengthStatus {
  count: number
  limit: number
  over: boolean
  /** How far past the limit, 0 when within it. */
  excess: number
}

/**
 * How a post's content measures against its platform's limit, or null when the
 * platform has no limit worth showing.
 *
 * Counts UTF-16 code units, the same thing `String.length` gives — which is
 * *not* how X counts. X weights by unicode range (most CJK counts double) and
 * collapses every URL to a fixed 23 characters regardless of its real length.
 * Reproducing that faithfully means shipping their character-counting rules,
 * which is a dependency and a maintenance burden for a number that is only ever
 * advisory here: nothing in this app publishes, and the real ceiling is enforced
 * by X at publish time whatever we display.
 *
 * The practical consequence is that this **over-counts a post containing links**
 * — a card may read 300/280 for something X would accept. That is the safe
 * direction to be wrong in: it nudges toward a shorter post rather than
 * promising one will fit when it won't. Revisit if and when publishing lands.
 */
export function postLengthStatus(
  content: string,
  platform: PostPlatform
): PostLengthStatus | null {
  const limit = PLATFORM_LENGTH_LIMITS[platform]
  if (!limit) return null

  // Trimmed, because trailing whitespace from an edit box is not something a
  // user would count and X strips it anyway.
  const count = content.trim().length

  return {
    count,
    limit,
    over: count > limit,
    excess: Math.max(0, count - limit),
  }
}

/** Whether moving this content to `platform` would produce an unpostable post. */
export function exceedsPlatformLimit(
  content: string,
  platform: PostPlatform
): boolean {
  return postLengthStatus(content, platform)?.over ?? false
}
