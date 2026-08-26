"use client"

import { CalendarBlank, CalendarCheck, CalendarDot } from "@phosphor-icons/react"

import type { Post } from "@/types/post"
import type { Instructions } from "@/types/instructions"
import type { ConnectedSocialAccount } from "@/types/social-account"
import type { UserAiModel } from "@/types/ai-model"
import { expiryStatus } from "@/lib/format-date"
import {
  createdInMonth,
  createdWithinDays,
  nextUp,
  platformSplit,
  postsInMonth,
  summariseMonth,
  topTopics,
  totalsByState,
} from "@/lib/dashboard-summary"
import { DottedDivider } from "@/components/instructions/dotted-divider"
import { MonthCalendarCard } from "@/components/dashboard/month-calendar-card"
import { NextUpColumn } from "@/components/dashboard/next-up-column"
import { PostingAboutCard } from "@/components/dashboard/posting-about-card"
import { SetupCard, type SetupRow } from "@/components/dashboard/setup-card"
import { StatCard } from "@/components/dashboard/stat-cards"
import { TotalPostsCard } from "@/components/dashboard/total-posts-card"

const POST_LIST_LIMIT = 6
const TOP_TOPICS_LIMIT = 8
const ACTIVITY_WINDOW_DAYS = 7

// The four My Voice fields; single-prompt mode replaces all of them with one
// textarea, which is why the check below branches.
const VOICE_FIELDS = ["tone", "contentRules", "postStructure", "whatToAvoid"] as const

function voiceRow(instructions: Instructions | null, href: string): SetupRow {
  if (instructions?.singlePrompt) {
    const filled = instructions.singlePromptText.trim() !== ""
    return {
      label: "Your voice",
      detail: filled ? "Single prompt" : "Empty",
      state: filled ? "done" : "todo",
      href,
    }
  }

  const filled = instructions
    ? VOICE_FIELDS.filter((field) => instructions[field].trim() !== "").length
    : 0

  return {
    label: "Your voice",
    // "3/4 fields", as the export writes it.
    detail: `${filled}/${VOICE_FIELDS.length} fields`,
    state: filled === VOICE_FIELDS.length ? "done" : filled > 0 ? "warning" : "todo",
    href,
  }
}

export function DashboardView({
  projectId,
  projectName,
  posts,
  instructions,
  writingStyleCount,
  referenceCount,
  socialAccounts,
  aiModels,
  // Stamped once by the page and passed down, so the future/past split can't
  // differ between the server render and hydration — the same reason the
  // Content page takes its own `now` as a prop.
  now,
  hrefs,
}: {
  projectId: string
  projectName: string
  posts: Post[]
  instructions: Instructions | null
  writingStyleCount: number
  referenceCount: number
  socialAccounts: ConnectedSocialAccount[]
  aiModels: UserAiModel[]
  now: number
  hrefs: {
    content: string
    instructions: string
    connections: string
    settings: string
    postBase: string
  }
}) {
  const nowDate = new Date(now)
  const summary = summariseMonth(posts, now)
  const totals = totalsByState(posts, now)
  const upcoming = nextUp(posts, now, POST_LIST_LIMIT)
  const recent = posts
    .filter((post) => post.scheduledFor !== null && Date.parse(post.scheduledFor) < now)
    .sort((a, b) => Date.parse(b.scheduledFor!) - Date.parse(a.scheduledFor!))
    .slice(0, POST_LIST_LIMIT)

  const monthPosts = posts.filter((post) => {
    if (post.scheduledFor === null) return false
    const date = new Date(post.scheduledFor)
    return date.getFullYear() === summary.year && date.getMonth() === summary.month
  })

  // Post ids per day of the summary month, so a day holding exactly one post
  // can link straight to it — the same per-post route the Next-up cards use —
  // instead of dropping you on Content to find the one thing that's there.
  const postIdsByDay = new Map<number, string[]>()
  for (const post of monthPosts) {
    const day = new Date(post.scheduledFor!).getDate()
    const existing = postIdsByDay.get(day)
    if (existing) existing.push(post.id)
    else postIdsByDay.set(day, [post.id])
  }

  // Wider than `monthPosts` on purpose: that set is scheduled-only, which the
  // calendar above needs and this card doesn't — a dateless post still says
  // something about what you're writing. Try-out posts are the case that made
  // this necessary: the usual Try out path schedules nothing, so the bar sat
  // at zero however many had been generated.
  const monthContentPosts = postsInMonth(posts, nowDate)

  const monthName = summary.label.split(" ")[0]
  const emptyRemaining = summary.daysRemaining - summary.remainingDaysCovered

  // A connection that's expiring or expired downgrades this row's tone rather
  // than raising a banner of its own — the export has no notices strip, and
  // this row is already the page's one place that reports on connections.
  const expiring = socialAccounts.some(
    (account) => expiryStatus(new Date(account.expiresAt), nowDate) !== "active"
  )
  const modelErrored = aiModels.some((model) => model.status === "error")

  const setupRows: SetupRow[] = [
    voiceRow(instructions, hrefs.instructions),
    {
      label: "Writing style",
      detail: `${writingStyleCount} ${writingStyleCount === 1 ? "example" : "examples"}`,
      state: writingStyleCount > 0 ? "done" : "todo",
      href: hrefs.instructions,
    },
    {
      label: "References",
      detail: `${referenceCount} ${referenceCount === 1 ? "item" : "items"}`,
      state: referenceCount > 0 ? "done" : "todo",
      href: hrefs.instructions,
    },
    {
      label: "Topics",
      detail: `${instructions?.topics.length ?? 0} chosen`,
      state: (instructions?.topics.length ?? 0) > 0 ? "done" : "todo",
      href: hrefs.instructions,
    },
    {
      label: "Connections",
      detail:
        socialAccounts.length === 0
          ? "None"
          : expiring
            ? "Expiring"
            : `${socialAccounts.length} active`,
      state: socialAccounts.length === 0 ? "todo" : expiring ? "warning" : "done",
      href: hrefs.connections,
    },
    {
      label: "AI Model",
      detail: modelErrored
        ? "Key failed"
        : aiModels.length === 0
          ? "Built-in"
          : `${aiModels.length} of your own`,
      state: modelErrored ? "warning" : "done",
      href: hrefs.settings,
    },
  ]

  return (
    // Same unified blur+opacity mount-in as every other section (see
    // /create-project for the @starting-style rationale) — one transition on
    // the whole group, no stagger.
    <div className="flex flex-1 flex-col gap-dist-xl transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      <h1 className="text-heading-sm font-display text-text-bold">{projectName}</h1>

      <div className="flex flex-col gap-dist-lg">
        <TotalPostsCard
          totals={totals}
          monthScheduled={summary.scheduled}
          monthQueued={summary.upcoming}
          monthPublished={summary.past}
        />

        <div className="flex flex-col gap-dist-md xl:flex-row">
          <StatCard
            label="Still to go out"
            icon={CalendarCheck}
            value={summary.upcoming}
            caption={`of ${summary.scheduled} total queued ${monthName}`}
          />
          <StatCard
            label="Written this week"
            icon={CalendarDot}
            value={createdWithinDays(posts, now, ACTIVITY_WINDOW_DAYS)}
            // Deliberately not "of N total this month": the value above is a
            // rolling 7-day window, which reaches back past the 1st for the
            // first week of any month, so it is not a subset of the month
            // figure and could exceed it ("6 of 1 total this month"). Two
            // plain figures, no implied subset.
            caption={`${createdInMonth(posts, new Date(now))} written in ${monthName}`}
          />
          <StatCard
            label="Empty days ahead"
            icon={CalendarBlank}
            value={emptyRemaining}
            caption={`${summary.daysRemaining} days left this month`}
          />
        </div>
      </div>

      <DottedDivider />

      {/* The calendar card sizes this row; the Next-up column then fills
          exactly that height and scrolls its own content, which is what the
          export draws (it clips mid-"Recently out"). An absolutely-positioned
          child is what makes that possible — out of flow, it contributes
          nothing to the row's content-based height, so a long list can't grow
          the row. Same trick as the Content page's panel. */}
      <div className="flex flex-col gap-dist-lg xl:flex-row xl:items-stretch">
        <MonthCalendarCard
          summary={summary}
          projectId={projectId}
          contentHref={hrefs.content}
          postBase={hrefs.postBase}
          postIdsByDay={postIdsByDay}
          className="xl:w-90 xl:shrink-0"
        />
        <div className="relative min-h-100 min-w-0 flex-1">
          <NextUpColumn
            upcoming={upcoming}
            recent={recent}
            postBase={hrefs.postBase}
            now={nowDate}
            className="absolute inset-0"
          />
        </div>
      </div>

      <DottedDivider />

      <div className="flex flex-col gap-dist-lg xl:flex-row xl:items-start">
        <PostingAboutCard
          topics={topTopics(monthContentPosts, TOP_TOPICS_LIMIT)}
          split={platformSplit(monthContentPosts)}
          total={monthContentPosts.length}
          className="xl:w-108 xl:shrink-0"
        />
        <SetupCard rows={setupRows} className="xl:min-w-0 xl:flex-1" />
      </div>
    </div>
  )
}
