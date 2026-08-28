import { formatDate } from "@/lib/format-date"
import type { Post } from "@/types/post"

// The Content page's three tabs (design-sync/content-base-calendar-view).
// Membership is decided by *date*, not by the posts table's own `status`
// column (per direct instruction): a post is queued if its scheduled date is
// still ahead, published once that date has passed, and a draft when it has
// no date at all.
export type ContentTab = "queued" | "published" | "draft"

export const CONTENT_TABS: { value: ContentTab; label: string }[] = [
  { value: "queued", label: "Queued" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
]

export interface DayGroup {
  // `${year}-${month}-${day}` — stable React key, and the same shape a future
  // day-detail view can look a date up by.
  key: string
  day: number
  posts: Post[]
}

export interface MonthGroup {
  key: string
  year: number
  // 0-indexed, as Date itself reports it.
  month: number
  // "July 2026" — Phudu renders it in caps, so it isn't uppercased here.
  label: string
  days: DayGroup[]
}

// "Aug 29" — the app's one date format (lib/format-date.ts), used as the day
// deck's accessible name and as each Kanban column's header.
export function formatDayLabel(month: MonthGroup, day: DayGroup): string {
  return formatDate(new Date(month.year, month.month, day.day))
}

export function belongsToTab(post: Post, tab: ContentTab, now: number): boolean {
  switch (tab) {
    case "queued":
      return post.scheduledFor !== null && Date.parse(post.scheduledFor) >= now
    case "published":
      return post.scheduledFor !== null && Date.parse(post.scheduledFor) < now
    case "draft":
      return post.scheduledFor === null
  }
}

export function postsForTab(posts: Post[], tab: ContentTab, now: number): Post[] {
  return posts.filter((post) => belongsToTab(post, tab, now))
}

// Free-text search over the posts themselves. Matches the post's **content**
// only (per direct instruction) — not topics, platform or date: the topics are
// already visible as chips on every card, and a date has its own tab and its
// own chip to find it by, so widening the net here would mostly return posts
// whose text has nothing to do with what was typed.
//
// Case-insensitive substring, no tokenising or ranking: the corpus is one
// person's own posts and the queries are the words they remember writing.
// Applied before the tab split, so a search still reads as "search within what
// I'm looking at" rather than jumping tabs on its own.
export function filterPostsByQuery(posts: Post[], query: string): Post[] {
  const needle = query.trim().toLowerCase()
  if (needle === "") return posts
  return posts.filter((post) => post.content.toLowerCase().includes(needle))
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`
}

// Which day's group a post lands in, or null when it isn't on this tab at all.
// The Content page uses it to answer one question an edit raises: does this
// post still belong to the day whose deck is open? A date change can move it
// to another day, to another tab, or nowhere at all — and the answer decides
// whether its card animates out of the deck or just updates in place.
export function dayKeyForPost(
  post: Post,
  tab: ContentTab,
  now: number
): string | null {
  if (!belongsToTab(post, tab, now)) return null
  const date = groupingDate(post, tab)
  return dayKey(date.getFullYear(), date.getMonth(), date.getDate())
}

// Which date a tab groups by. Queued/Published group by the date the post is
// scheduled for — the whole point of those two tabs. Drafts have no such date,
// so they fall under the day they were created (per direct instruction), which
// keeps the chips and the "tap a day" interaction identical across all three
// tabs rather than needing a shape of its own.
function groupingDate(post: Post, tab: ContentTab): Date {
  return new Date(tab === "draft" ? post.createdAt : (post.scheduledFor ?? post.createdAt))
}

// Newest-first everywhere except Queued, which reads forwards: the next thing
// going out belongs at the top, while an archive (Published) and a pile of
// drafts both want their most recent entries first.
function isAscending(tab: ContentTab): boolean {
  return tab === "queued"
}

// Within a day, posts sort by **the scheduled time itself**, in the same
// direction the days around them read: Queued forwards (the next one out sits
// at the top of its day, as it does across days), Published backwards.
//
// This used to sort by creation instead, and the comment said why — "posts
// generated into the same day usually share a time, so that would leave the
// order arbitrary". A batch does still share a time, which is exactly why the
// creation order is kept as the tiebreak; what changed is that a time can now
// differ, and when it does it is the only ordering anyone means by "sort by
// date and time".
//
// Draft has no scheduled time at all (it is the tab's definition), so it
// falls through to the tiebreak and reads newest-first as it always has.
function comparePosts(a: Post, b: Post, tab: ContentTab, ascending: boolean): number {
  if (tab !== "draft") {
    const at = a.scheduledFor ? Date.parse(a.scheduledFor) : null
    const bt = b.scheduledFor ? Date.parse(b.scheduledFor) : null
    if (at !== null && bt !== null && at !== bt) {
      return ascending ? at - bt : bt - at
    }
  }
  // Same moment (a batch), or no moment at all: most recently written first.
  return Date.parse(b.createdAt) - Date.parse(a.createdAt)
}

// Groups a tab's posts into month sections, each holding one entry per day
// that has posts (empty days are simply absent — this is a list of days that
// have content, not a month grid).
//
// Deliberately reads the *local* date parts: a scheduled date is picked as a
// calendar day in the user's own timezone (Calendar hands back local midnight,
// which is then stored as UTC), so local is the only reading that recovers the
// day the user actually chose. That makes this browser-correct and, on a
// server rendering in a different timezone, approximate for posts sitting
// within a few hours of midnight — the client render is the authority.
export function groupPostsByMonth(posts: Post[], tab: ContentTab, now: number): MonthGroup[] {
  const ascending = isAscending(tab)
  const months = new Map<string, MonthGroup>()

  for (const post of postsForTab(posts, tab, now)) {
    const date = groupingDate(post, tab)
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    const monthKey = `${year}-${month}`
    const key = dayKey(year, month, day)

    let monthGroup = months.get(monthKey)
    if (!monthGroup) {
      monthGroup = {
        key: monthKey,
        year,
        month,
        label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        days: [],
      }
      months.set(monthKey, monthGroup)
    }

    const dayGroup = monthGroup.days.find((entry) => entry.key === key)
    if (dayGroup) {
      dayGroup.posts.push(post)
    } else {
      monthGroup.days.push({ key, day, posts: [post] })
    }
  }

  const direction = ascending ? 1 : -1
  const sorted = [...months.values()].sort(
    (a, b) => (a.year - b.year || a.month - b.month) * direction
  )
  for (const monthGroup of sorted) {
    monthGroup.days.sort((a, b) => (a.day - b.day) * direction)
    for (const dayGroup of monthGroup.days) {
      dayGroup.posts.sort((a, b) => comparePosts(a, b, tab, ascending))
    }
  }

  return sorted
}
