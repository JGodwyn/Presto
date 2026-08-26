import { TRY_OUT_LABEL } from "@/lib/post-account"
import type { Post, PostPlatform } from "@/types/post"

// The Content page's filter (design-sync/content-filter-1, content-filter-2):
// one social platform and any number of topics. Kept separate from the tab
// split and the search query in lib/content-grouping.ts — those decide *what
// section of the app you're in*, this narrows what's shown inside it.
//
// "tryout" is a position of its own rather than a platform, for the same
// reason lib/post-account.ts makes it one on the account pill: a try-out post
// carries a real platform (it has to be written for somewhere) with `isTryout`
// set alongside, so filtering by "linkedin" alone would hand back the try-out
// posts too, which is exactly what the person filtering was trying to exclude.
export type PlatformFilter = "all" | PostPlatform | "tryout"

export interface ContentFilter {
  platform: PlatformFilter
  // Empty means every topic, which is the export's "All topics" row. Storing
  // the absence rather than "all of them" is what keeps a topic appearing on a
  // newly generated post from silently falling outside an existing filter.
  topics: string[]
}

// A single frozen instance, deliberately: it's the value every "nothing
// selected" path returns, and `useSyncExternalStore` re-renders on any change
// of snapshot *identity*, so handing back a fresh `{}` each read would loop.
export const NO_CONTENT_FILTER: ContentFilter = { platform: "all", topics: [] }

// The Social row is a cycling control (the export gives it the same
// ArrowsClockwise the "Show as" pill uses), not a dropdown — with four
// values a tap-through is still fewer interactions than open-then-pick.
// "Try out" comes last, after the real accounts, matching the order the
// dashboard's own platform bars read in.
const PLATFORM_CYCLE: PlatformFilter[] = ["all", "linkedin", "x", "tryout"]

export const PLATFORM_FILTER_LABELS: Record<PlatformFilter, string> = {
  all: "All",
  linkedin: "LinkedIn",
  x: "X",
  tryout: TRY_OUT_LABEL,
}

export function nextPlatformFilter(current: PlatformFilter): PlatformFilter {
  const index = PLATFORM_CYCLE.indexOf(current)
  return PLATFORM_CYCLE[(index + 1) % PLATFORM_CYCLE.length]
}

export function isContentFilterActive(filter: ContentFilter): boolean {
  return filter.platform !== "all" || filter.topics.length > 0
}

// The topics offered are the ones actually on this project's posts, not the
// instructions' topic list: an option that can only ever return nothing is
// worse than no option at all. Sorted alphabetically — the counts are heavily
// skewed in practice, and ordering by frequency would move rows around as
// posts are added.
export function topicsInPosts(posts: Post[]): string[] {
  const topics = new Set<string>()
  for (const post of posts) {
    for (const topic of post.topics) topics.add(topic)
  }
  return [...topics].sort((a, b) => a.localeCompare(b))
}

// Whether a post sits under the selected social. `isTryout` is checked first,
// the same precedence post-account.ts resolves a pill by and
// dashboard-summary.ts's platformSplit counts by — so the three values are
// disjoint and every post falls under exactly one of them.
export function matchesPlatformFilter(
  post: Pick<Post, "platform" | "isTryout">,
  platform: PlatformFilter
): boolean {
  if (platform === "all") return true
  if (platform === "tryout") return post.isTryout
  return !post.isTryout && post.platform === platform
}

// Platform ANDs with topics; topics OR among themselves — picking Design and
// Leadership asks for posts about either, which is what ticking two boxes in a
// list reads as.
export function filterPosts(posts: Post[], filter: ContentFilter): Post[] {
  if (!isContentFilterActive(filter)) return posts
  const topics = new Set(filter.topics)
  return posts.filter((post) => {
    if (!matchesPlatformFilter(post, filter.platform)) return false
    if (topics.size === 0) return true
    return post.topics.some((topic) => topics.has(topic))
  })
}

// Ticking a topic clears nothing else; unticking the last one lands back on
// "All topics" on its own, which is the same state the All topics row sets.
export function toggleTopicFilter(topics: string[], topic: string): string[] {
  return topics.includes(topic)
    ? topics.filter((entry) => entry !== topic)
    : [...topics, topic]
}

const PLATFORM_VALUES = new Set<string>(PLATFORM_CYCLE)

// Parses a stored filter back into shape, falling back to "nothing selected"
// for anything unusable — no entry, malformed JSON, a platform that no longer
// exists, a topics value that isn't a list of strings. Kept here rather than
// in the storage module so it can be tested without a localStorage to stub.
export function parseContentFilter(raw: string | null): ContentFilter {
  if (!raw) return NO_CONTENT_FILTER
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NO_CONTENT_FILTER
  }
  if (typeof parsed !== "object" || parsed === null) return NO_CONTENT_FILTER
  const { platform, topics } = parsed as Record<string, unknown>
  const filter: ContentFilter = {
    platform:
      typeof platform === "string" && PLATFORM_VALUES.has(platform)
        ? (platform as PlatformFilter)
        : "all",
    topics: Array.isArray(topics)
      ? topics.filter((topic): topic is string => typeof topic === "string")
      : [],
  }
  // Same identity for the same meaning, so a restored "nothing selected" and
  // the constant are interchangeable to the store's subscribers.
  return isContentFilterActive(filter) ? filter : NO_CONTENT_FILTER
}

// Drops selected topics that no longer exist on any post. Without this, a
// topic filter saved before those posts were deleted or retagged would keep
// emptying the page with nothing in the menu to explain it — the topic can't
// be listed, because the list is built from the posts that remain. Returns the
// same object when nothing changed, so it's safe to derive on every render.
export function reconcileContentFilter(
  filter: ContentFilter,
  availableTopics: string[]
): ContentFilter {
  if (filter.topics.length === 0) return filter
  const available = new Set(availableTopics)
  const topics = filter.topics.filter((topic) => available.has(topic))
  if (topics.length === filter.topics.length) return filter
  const reconciled: ContentFilter = { ...filter, topics }
  return isContentFilterActive(reconciled) ? reconciled : NO_CONTENT_FILTER
}
