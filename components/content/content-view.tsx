"use client"

import * as React from "react"
import { ArrowsClockwise, Eyes } from "@phosphor-icons/react"

import { DayDeck, type DeckOrigin } from "@/components/content/day-deck"
import { MonthBoard } from "@/components/content/month-board"
import { MonthSection } from "@/components/content/month-section"
import { EmptyState } from "@/components/shared/empty-state"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import {
  CONTENT_TABS,
  dayKeyForPost,
  formatDayLabel,
  groupPostsByMonth,
  type ContentTab,
} from "@/lib/content-grouping"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"

// Figma --rad-xmd as px for the squircle path math (the "Show as" pill).
const SHOW_AS_CORNER_RADIUS = 12

// How the day's posts are laid out. Tapping the "Show as" pill cycles through
// these in order — two for now (design-sync/content-base-calendar-view and
// content-kanban-view); a List view has been mentioned but not exported, and
// adding it here is all it would take.
const CONTENT_VIEWS = [
  { value: "calendar", label: "Calendar" },
  { value: "kanban", label: "Kanban" },
] as const

type ContentViewMode = (typeof CONTENT_VIEWS)[number]["value"]

// How far the months dissolve at each end of the page's own scroll area.
// Bottom is deeper for the same reason it is inside a Kanban column: it's the
// only thing signalling there's more below, where the top fade only matters
// once you're already scrolling and know that.
const PAGE_FADE_TOP_PX = 24
const PAGE_FADE_BOTTOM_PX = 48

// Half a turn per tap, accumulating rather than resetting, so repeated taps
// keep spinning the same way instead of snapping back between them.
const SHOW_AS_ICON_SPIN_DEG = 180
// Long enough to read as a turn rather than a flicker; the strong ease-out
// this codebase uses everywhere for something arriving.
const SHOW_AS_ICON_SPIN_MS = 300
const SHOW_AS_ICON_SPIN_EASING = "cubic-bezier(0.23, 1, 0.32, 1)"

// One line per tab, in the export's own caption/title split (the small grey
// line names the state, the big Phudu line carries the message). Only the
// Queued pair is from the export — the other two are written to match it,
// since the Published/Draft empty states haven't been exported.
const EMPTY_STATE_TITLES: Record<ContentTab, string> = {
  queued: "your posts for a later date show up here.",
  published: "your posts from a past date show up here.",
  draft: "your posts without a date show up here.",
}

// The Content page, from the Figma "Content / Empty state" and "Content /
// Base calendar view" exports. Three date-based tabs over a list of month
// sections, each holding one chip per day that has posts — see
// lib/content-grouping.ts for what lands in which tab.
export function ContentView({
  projectId,
  posts: initialPosts,
  // Stamped by the server component that renders this, so the future/past
  // split is decided once rather than drifting between the server render and
  // hydration (a post scheduled seconds from now would otherwise be able to
  // change tabs mid-hydration).
  now,
}: {
  projectId: string
  posts: Post[]
  now: number
}) {
  const [tab, setTab] = React.useState<ContentTab>("queued")
  const [viewIndex, setViewIndex] = React.useState(0)
  const view: ContentViewMode = CONTENT_VIEWS[viewIndex % CONTENT_VIEWS.length].value
  // Client state seeded from the server fetch, so edits made inside a day's
  // deck (date changes, deletes, platform switches) are reflected in the
  // chips and their counts straight away rather than after a refresh — same
  // pattern as the Instructions cards.
  const [posts, setPosts] = React.useState(initialPosts)
  // Which day's deck is open, plus the chip it opened from: the deck animates
  // out of that element's box, and focus returns to it on close. The origin
  // rect is measured once, at click time, rather than per render — it feeds
  // the deck's animation effects, and a fresh object every render would keep
  // restarting them.
  const [openDay, setOpenDay] = React.useState<{
    key: string
    trigger: HTMLButtonElement
    origin: DeckOrigin
  } | null>(null)

  const months = React.useMemo(
    () => groupPostsByMonth(posts, tab, now),
    [posts, tab, now]
  )

  // Re-derived from `months` rather than captured at click time, so a deck
  // that's already open follows its own day's posts as they're edited.
  const openEntry = openDay
    ? months
        .flatMap((month) => month.days.map((day) => ({ month, day })))
        .find((entry) => entry.day.key === openDay.key)
    : undefined

  const closeDeck = React.useCallback(() => {
    openDay?.trigger.focus()
    setOpenDay(null)
  }, [openDay])

  // Switching tabs while a deck is open would leave it pointing at a day that
  // isn't in view any more.
  const handleTabChange = (value: ContentTab) => {
    setOpenDay(null)
    setTab(value)
  }

  const { ref: showAsRef, style: showAsStyle } =
    useSquircleClipPath<HTMLButtonElement>({
      cornerRadius: SHOW_AS_CORNER_RADIUS,
    })
  // One hook for both layouts: only ever one of the two scroll areas below is
  // mounted, and a callback ref follows whichever it is.
  const { ref: monthsRef, onScroll: onMonthsScroll } = useScrollFade({
    axis: "y",
    start: PAGE_FADE_TOP_PX,
    end: PAGE_FADE_BOTTOM_PX,
  })

  // The icon's turn is animated imperatively rather than transitioned from the
  // `rotate` below. A CSS transition only fires if the browser observed the
  // old value in a rendered frame first, and the tap that changes it also
  // swaps out every month under it — a commit big enough that the change was
  // sometimes applied without a transition ever starting, so the icon jumped
  // (confirmed in-browser: same node, `transition-property: rotate`, 0.3s
  // duration, and no `transitionrun` event at all). An animation states its
  // own from/to, so it can't depend on what the previous frame happened to
  // compute. The inline `rotate` still holds the resting value, which is what
  // the animation lands on when it finishes.
  const iconRef = React.useRef<SVGSVGElement>(null)
  const spinRef = React.useRef(0)

  const cycleView = () => {
    const from = spinRef.current
    const to = from + SHOW_AS_ICON_SPIN_DEG
    spinRef.current = to
    iconRef.current?.animate(
      [{ rotate: `${from}deg` }, { rotate: `${to}deg` }],
      { duration: SHOW_AS_ICON_SPIN_MS, easing: SHOW_AS_ICON_SPIN_EASING }
    )
    setViewIndex((index) => index + 1)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-dist-xl p-pad-2xl">
      <h1 className="text-heading-md font-display text-text-bold">Content</h1>

      <div className="flex flex-col gap-dist-md">
        <div className="flex items-center justify-between">
          <SegmentedControl
            className="w-90"
            value={tab}
            onValueChange={(value) => handleTabChange(value as ContentTab)}
            items={CONTENT_TABS}
          />

          {/* Tap to cycle the layout. The icon keeps turning half a rotation
              per tap (it isn't a state indicator, it's the act of switching),
              and the pill itself takes the app's standard 150ms press scale. */}
          <button
            ref={showAsRef}
            style={showAsStyle}
            type="button"
            onClick={cycleView}
            aria-label={`Showing as ${CONTENT_VIEWS[viewIndex % CONTENT_VIEWS.length].label} — tap to change`}
            className="flex cursor-pointer items-center gap-dist-md rounded-rad-xmd bg-surface-3 px-pad-md py-pad-xs transition-[background-color,scale] duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
          >
            <span className="text-body-lg text-text-subtle">Show as:</span>
            <span className="text-body-lg text-text-bold">
              {CONTENT_VIEWS[viewIndex % CONTENT_VIEWS.length].label}
            </span>
            <ArrowsClockwise
              ref={iconRef}
              weight="bold"
              style={{ rotate: `${viewIndex * SHOW_AS_ICON_SPIN_DEG}deg` }}
              className="size-5 text-icon-bold"
            />
          </button>
        </div>
      </div>

      {/* Only this part scrolls (per direct feedback): the panel is exactly
          the viewport's height, so the title, tabs and info line stay put
          while the months move under them. min-h-0 is what bounds it — a flex
          item's automatic minimum is its content, which would otherwise push
          the column past the panel and take the whole page with it. */}
      {months.length === 0 ? (
        <EmptyState
          icon={Eyes}
          caption="Nothing to show here"
          title={EMPTY_STATE_TITLES[tab]}
        />
      ) : view === "kanban" ? (
        <div
          ref={monthsRef}
          onScroll={onMonthsScroll}
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-dist-xl overflow-y-auto",
            HIDE_NATIVE_SCROLLBAR_CLASSNAME
          )}
        >
          {months.map((month) => (
            <MonthBoard
              key={month.key}
              month={month}
              postHref={(post) => `/projects/${projectId}/calendar/${post.id}`}
            />
          ))}
        </div>
      ) : (
        <div
          ref={monthsRef}
          onScroll={onMonthsScroll}
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-dist-xl overflow-y-auto",
            HIDE_NATIVE_SCROLLBAR_CLASSNAME
          )}
        >
          {months.map((month) => (
            <MonthSection
              key={month.key}
              month={month}
              onOpenDay={(key, trigger) => {
                const rect = trigger.getBoundingClientRect()
                setOpenDay({
                  key,
                  trigger,
                  origin: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                  },
                })
              }}
            />
          ))}
        </div>
      )}

      {openDay && openEntry ? (
        <DayDeck
          projectId={projectId}
          dateLabel={formatDayLabel(openEntry.month, openEntry.day)}
          posts={openEntry.day.posts}
          origin={openDay.origin}
          dayKey={openDay.key}
          keyForPost={(post) => dayKeyForPost(post, tab, now)}
          onClose={closeDeck}
          onPostsChange={setPosts}
        />
      ) : null}
    </div>
  )
}
