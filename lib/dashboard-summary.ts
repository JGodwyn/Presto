import type { Post, PostPlatform } from "@/types/post"

// Everything the dashboard reads is derived here, from the posts table alone.
//
// The split is *date-derived*, deliberately mirroring lib/content-grouping.ts
// rather than reading the posts table's own `status` column. Two reasons: the
// Content page already decides its tabs that way (per direct instruction), so
// a status-derived dashboard would contradict the page it summarises; and
// nothing in the app ever writes `status: "published"` — only "draft" and
// "scheduled" are ever inserted — so a "Posted" count read off that column
// would sit at zero forever. If a real `published_at` lands later, this file
// is the single place that changes.
//
// Local date parts throughout, same as content-grouping: a scheduled day is
// picked in the user's own timezone (Calendar hands back local midnight,
// stored as UTC), so only a local read recovers the day actually chosen.

export interface MonthSummary {
  year: number
  // 0-indexed, as Date reports it.
  month: number
  // "August 2026" — Phudu renders it in caps, so it isn't uppercased here.
  label: string
  daysInMonth: number
  // Day-of-month when `now` falls inside this month, else null. The heatmap
  // uses it to ring today and to dim the days already gone.
  today: number | null
  // Posts scheduled anywhere in this month, ahead or behind.
  scheduled: number
  upcoming: number
  past: number
  // One entry per day, index 0 = the 1st. Empty days are 0 rather than absent
  // — this is a grid, unlike content-grouping's list of days that have posts.
  countsByDay: number[]
  // Of those, how many are still ahead of `now`. Same indexing. The dashboard
  // calendar uses it to decide which Content tab a day belongs to: a day with
  // anything still to come is Queued, otherwise its posts have all gone and it
  // is Published. Deciding that from the date alone would send *today* to
  // Queued even when everything on it already went out.
  upcomingByDay: number[]
  daysCovered: number
  // Today included: a day with hours left in it is still a day you can post
  // on, and calling it "remaining" while excluding it reads as off-by-one.
  daysRemaining: number
  // Of those remaining days, how many already have something scheduled. This
  // is the number the "on track?" read actually rests on — total coverage
  // counts days that are already spent and can no longer be fixed.
  remainingDaysCovered: number
}

function isSameMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month
}

export function summariseMonth(
  posts: Post[],
  now: number,
  // Which month to summarise — the month `now` is in, unless a caller wants
  // to look at another one.
  reference: Date = new Date(now)
): MonthSummary {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const nowDate = new Date(now)
  const today = isSameMonth(nowDate, year, month) ? nowDate.getDate() : null

  const countsByDay = new Array<number>(daysInMonth).fill(0)
  const upcomingByDay = new Array<number>(daysInMonth).fill(0)
  let scheduled = 0
  let upcoming = 0
  let past = 0

  for (const post of posts) {
    if (post.scheduledFor === null) continue
    const at = Date.parse(post.scheduledFor)
    const date = new Date(at)
    if (!isSameMonth(date, year, month)) continue

    scheduled += 1
    countsByDay[date.getDate() - 1] += 1
    if (at >= now) {
      upcoming += 1
      upcomingByDay[date.getDate() - 1] += 1
    } else past += 1
  }

  const daysCovered = countsByDay.filter((count) => count > 0).length
  const daysRemaining = today === null ? daysInMonth : daysInMonth - today + 1
  const remainingDaysCovered =
    today === null
      ? daysCovered
      : countsByDay.slice(today - 1).filter((count) => count > 0).length

  return {
    year,
    month,
    label: reference.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    daysInMonth,
    today,
    scheduled,
    upcoming,
    past,
    countsByDay,
    upcomingByDay,
    daysCovered,
    daysRemaining,
    remainingDaysCovered,
  }
}

// Drafts are counted project-wide, not per month: a draft has no date at all,
// so "drafts this month" would have to fall back to its creation date — which
// is what the Content page's Draft tab groups by, but it isn't what makes the
// number actionable here. The point of this figure is "you have unscheduled
// work sitting there", and that's true whenever it was written.
export function countUnscheduled(posts: Post[]): number {
  return posts.filter((post) => post.scheduledFor === null).length
}

// The next few posts going out, soonest first — the same reading order as the
// Content page's Queued tab.
export function nextUp(posts: Post[], now: number, limit: number): Post[] {
  return posts
    .filter((post) => post.scheduledFor !== null && Date.parse(post.scheduledFor) >= now)
    .sort((a, b) => Date.parse(a.scheduledFor!) - Date.parse(b.scheduledFor!))
    .slice(0, limit)
}

export interface TopicCount {
  topic: string
  count: number
}

// Most-used topics across the posts handed in. Ties break alphabetically so
// the list is stable between renders rather than following insertion order —
// a dashboard that reshuffles its own chips on every refresh reads as broken.
export function topTopics(posts: Post[], limit: number): TopicCount[] {
  const counts = new Map<string, number>()
  for (const post of posts) {
    for (const topic of post.topics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, limit)
}

// Keyed on the account a post reads as, which is not the same thing as its
// platform column. A "Try out" post carries `platform: "linkedin"` (that
// column names a real connected account, and social_accounts is unique per
// project+platform) with `isTryout` set alongside — so counting by platform
// alone files every try-out post under LinkedIn. The flag is checked first,
// exactly as post-account.ts resolves the same post to Eyes + "Try out"
// rather than the user's LinkedIn name.
export type PlatformSplit = Record<PostPlatform | "tryout", number>

export function platformSplit(posts: Post[]): PlatformSplit {
  const split: PlatformSplit = { linkedin: 0, x: 0, tryout: 0 }
  for (const post of posts) {
    if (post.isTryout) split.tryout += 1
    else split[post.platform] += 1
  }
  return split
}

const MS_PER_DAY = 86_400_000

// Posts *written* in the last n days, from created_at — the one figure here
// that measures activity rather than plan. It answers "have I generated
// anything lately", which scheduled counts can't: a month laid out in one
// sitting looks identically busy the day after and three weeks later.
export function createdWithinDays(posts: Post[], now: number, days: number): number {
  const cutoff = now - days * MS_PER_DAY
  return posts.filter((post) => Date.parse(post.createdAt) >= cutoff).length
}

// "Today" / "Tomorrow" / "in 5 days" — the relative read the Next-up list
// needs alongside the absolute date. It lives here rather than in
// lib/format-date.ts deliberately: that file is a declared hot file (AGENTS.md
// — two live branches editing one is a guaranteed conflict), and nothing
// outside the dashboard needs this yet. Move it there once something does.
//
// Compares calendar days, not elapsed milliseconds: a post 20 hours out is
// "Tomorrow" if it crosses midnight and "Today" if it doesn't, which 20 hours
// on its own can't tell you.
export function formatRelativeDay(date: Date, now: Date): string {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()

  const days = Math.round((startOfDay(date) - startOfDay(now)) / MS_PER_DAY)
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  if (days < 0) return `${-days} ${days === -1 ? "day" : "days"} ago`
  return `in ${days} days`
}

// The whole library split three ways, for the Total-posts bar and its legend.
// Global, not month-scoped: the bar sits under "Total posts", and drafts in
// particular have no date to scope them by (see countUnscheduled).
export interface PostTotals {
  total: number
  draft: number
  queued: number
  published: number
}

export function totalsByState(posts: Post[], now: number): PostTotals {
  const totals: PostTotals = { total: posts.length, draft: 0, queued: 0, published: 0 }
  for (const post of posts) {
    if (post.scheduledFor === null) totals.draft += 1
    else if (Date.parse(post.scheduledFor) >= now) totals.queued += 1
    else totals.published += 1
  }
  return totals
}

// Posts *written* in the reference month, from created_at — the denominator
// the "Written this week" card counts against ("of 23 total this month").
export function createdInMonth(posts: Post[], reference: Date): number {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  return posts.filter((post) => {
    const date = new Date(post.createdAt)
    return date.getFullYear() === year && date.getMonth() === month
  }).length
}
