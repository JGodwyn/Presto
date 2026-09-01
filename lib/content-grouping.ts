import { formatDate } from "@/lib/format-date"
import type { Post } from "@/types/post"

// The Content page's three tabs (design-sync/content-base-calendar-view).
//
// Published is decided by `publishedAt` — the recorded fact that a provider
// confirmed the post went out — and the other two by date. This used to be
// date-only: published meant "the scheduled date has passed", which cannot
// tell a post that actually went out from one whose date arrived while
// nothing happened (publish failed, token expired, nothing was running).
// Both read as published, identically for LinkedIn and X, since platform was
// never consulted at all.
//
// The three arms are total and disjoint, in this order:
//   published  publishedAt is set, whenever that happened
//   draft      no scheduled date and never published
//   queued     has a date, not published — including a date already past
//
// An overdue post staying in Queued is the honest answer: it is still waiting
// to go out, and nothing has sent it. `isOverdue` and `hasFailed` below are
// what let the UI say so rather than leaving it looking merely scheduled.
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

export function belongsToTab(post: Post, tab: ContentTab): boolean {
  switch (tab) {
    case "published":
      return post.publishedAt !== null
    case "draft":
      return post.publishedAt === null && post.scheduledFor === null
    case "queued":
      return post.publishedAt === null && post.scheduledFor !== null
  }
}

// A queued post whose moment has passed without it going out. Not a tab of its
// own — the design has three — but the card needs to say so, because
// "scheduled for last Tuesday" and "scheduled for next Tuesday" are not the
// same state and used to be indistinguishable once the date slid past.
export function isOverdue(post: Post, now: number): boolean {
  return (
    post.publishedAt === null &&
    post.scheduledFor !== null &&
    Date.parse(post.scheduledFor) < now
  )
}

// An attempt was made and the provider refused it. Distinct from merely
// overdue: something tried, and there is a reason to show.
export function hasFailed(post: Post): boolean {
  return post.publishedAt === null && post.publishError !== null
}

// `now` is gone from this chain: membership is a property of the post now, not
// of when you happen to be looking. The page still stamps a `now` — `isOverdue`
// needs it — it just no longer decides which tab anything is on.
export function postsForTab(posts: Post[], tab: ContentTab): Post[] {
  return posts.filter((post) => belongsToTab(post, tab))
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
export function dayKeyForPost(post: Post, tab: ContentTab): string | null {
  if (!belongsToTab(post, tab)) return null
  const date = groupingDate(post, tab)
  return dayKey(date.getFullYear(), date.getMonth(), date.getDate())
}

// Which date a tab groups by.
//
// Published groups by when it actually went out, not by when it was scheduled
// to: a post that published two days late belongs on the day it published, and
// that is also the only date a post published straight from a draft has.
// Queued groups by the date it is due. Drafts have neither, so they fall under
// the day they were created (per direct instruction), which keeps the chips and
// the "tap a day" interaction identical across all three tabs rather than
// needing a shape of its own.
function groupingDate(post: Post, tab: ContentTab): Date {
  return new Date(groupingTimestamp(post, tab))
}

// The single moment a tab orders and groups a post by. Grouping and sorting
// have to read the *same* field or a day's chip and the cards inside it
// disagree — Published grouped by `publishedAt` while still sorting by
// `scheduledFor` put posts in a day they hadn't been ordered against.
function groupingTimestamp(post: Post, tab: ContentTab): string {
  switch (tab) {
    case "published":
      return post.publishedAt ?? post.scheduledFor ?? post.createdAt
    case "queued":
      return post.scheduledFor ?? post.createdAt
    case "draft":
      return post.createdAt
  }
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
    const at = Date.parse(groupingTimestamp(a, tab))
    const bt = Date.parse(groupingTimestamp(b, tab))
    if (at !== bt) {
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
export function groupPostsByMonth(posts: Post[], tab: ContentTab): MonthGroup[] {
  const ascending = isAscending(tab)
  const months = new Map<string, MonthGroup>()

  for (const post of postsForTab(posts, tab)) {
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
