"use client"

import * as React from "react"
import {
  ArrowsClockwise,
  Eyes,
  FunnelSimple,
  Info,
  MagnifyingGlass,
} from "@phosphor-icons/react"

import { ContentFilterMenu } from "@/components/content/content-filter"
import { ContentSearch } from "@/components/content/content-search"
import { DayDeck, type DeckOrigin } from "@/components/content/day-deck"
import { MonthBoard } from "@/components/content/month-board"
import { MonthSection } from "@/components/content/month-section"
import { EmptyState } from "@/components/shared/empty-state"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useIconSpin } from "@/hooks/use-icon-spin"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { useScrollMemory } from "@/hooks/use-scroll-memory"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import {
  CONTENT_TABS,
  dayKeyForPost,
  filterPostsByQuery,
  formatDayLabel,
  groupPostsByMonth,
  type ContentTab,
} from "@/lib/content-grouping"
import {
  CONTENT_VIEWS,
  getContentFilter,
  getContentTab,
  getContentView,
  getServerContentFilter,
  getServerContentTab,
  getServerContentView,
  setContentFilter,
  setContentTab,
  setContentView,
  subscribeToContentView,
} from "@/lib/content-view"
import {
  filterPosts,
  isContentFilterActive,
  reconcileContentFilter,
  topicsInPosts,
  type ContentFilter,
} from "@/lib/content-filter"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"
import type { ConnectedSocialAccount } from "@/types/social-account"

// Figma --rad-xmd as px for the squircle path math (the "Show as" pill).
const SHOW_AS_CORNER_RADIUS = 12

// How far the months dissolve at each end of the page's own scroll area.
// Bottom is deeper for the same reason it is inside a Kanban column: it's the
// only thing signalling there's more below, where the top fade only matters
// once you're already scrolling and know that.
const PAGE_FADE_TOP_PX = 24
const PAGE_FADE_BOTTOM_PX = 48

// How much of the query the "nothing found" message echoes back. The empty
// state's text blocks are a fixed 272px wide by design, and an unbroken string
// longer than that would run straight out of the block.
const ECHOED_QUERY_MAX_CHARS = 32

// One line per tab, in the export's own caption/title split (the small grey
// line names the state, the big Phudu line carries the message). Only the
// Queued pair is from the export — the other two are written to match it,
// since the Published/Draft empty states haven't been exported.
const EMPTY_STATE_TITLES: Record<ContentTab, string> = {
  queued: "your posts for a later date show up here.",
  published: "your posts that have gone out show up here.",
  draft: "your posts without a date show up here.",
}

// Trimmed to the field's own trailing ellipsis rather than CSS truncation:
// the query sits mid-sentence inside the empty state's heading, where an
// overflowing line-clamp would cut the rest of the sentence off with it.
function echoQuery(query: string): string {
  const trimmed = query.trim()
  return trimmed.length > ECHOED_QUERY_MAX_CHARS
    ? `${trimmed.slice(0, ECHOED_QUERY_MAX_CHARS)}…`
    : trimmed
}

// The Content page, from the Figma "Content / Empty state" and "Content /
// Base calendar view" exports. Three date-based tabs over a list of month
// sections, each holding one chip per day that has posts — see
// lib/content-grouping.ts for what lands in which tab.
export function ContentView({
  projectId,
  posts: initialPosts,
  // This project's connected social accounts, so a post card can name the
  // account it goes out as rather than its platform (lib/post-account.ts).
  accounts,
  // The project's *current* Instructions topics. A post's own topics are a
  // denormalized snapshot taken at generation time, with no foreign key
  // behind them, so a topic deleted from Instructions since then still sits
  // on the post — this is the only way to tell that chip apart and retire it.
  activeTopics,
}: {
  projectId: string
  posts: Post[]
  accounts: ConnectedSocialAccount[]
  activeTopics: string[]
}) {
  // Remembered per project alongside the layout, so leaving for a post's own
  // page and coming back doesn't drop you on Queued.
  const tab = React.useSyncExternalStore(
    subscribeToContentView,
    () => getContentTab(projectId),
    getServerContentTab
  )
  // The layout this project was last viewed in, straight from the store — the
  // server snapshot is the default, so the first client pass agrees with the
  // markup and then switches to whatever was saved.
  const view = React.useSyncExternalStore(
    subscribeToContentView,
    () => getContentView(projectId),
    getServerContentView
  )
  // Client state seeded from the server fetch, so edits made inside a day's
  // deck (date changes, deletes, platform switches) are reflected in the
  // chips and their counts straight away rather than after a refresh — same
  // pattern as the Instructions cards.
  const [posts, setPosts] = React.useState(initialPosts)
  // Owned here rather than inside ContentSearch: it filters the months below,
  // so the page is what has to know it. It deliberately survives a tab switch
  // — searching, finding nothing on Queued and checking Draft is the same
  // search, not a new one.
  const [query, setQuery] = React.useState("")
  // Persisted per project alongside the tab and the layout (by request), so it
  // survives both a tab switch and a refresh. Read through the same store, so
  // there's no local copy to keep in step — writing is what re-renders.
  const storedFilter = React.useSyncExternalStore(
    subscribeToContentView,
    () => getContentFilter(projectId),
    getServerContentFilter
  )
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

  // Offered topics come from every post in the project, not from what the
  // current tab or query happens to show — a list that reshuffled as you typed
  // would be unusable, and a topic vanishing mid-filter would strand the
  // selection that produced the empty page.
  const topics = React.useMemo(() => topicsInPosts(posts), [posts])
  // Membership is checked once per topic chip, of which a busy month has
  // many — a Set built once per change beats an array scan each time.
  const activeTopicSet = React.useMemo(
    () => new Set(activeTopics),
    [activeTopics]
  )

  // A stored filter can name a topic that no longer exists on any post, and
  // that topic can't appear in the menu (the menu is built from the posts that
  // remain) — so it would empty the page with nothing to explain it. Derived
  // rather than repaired in place: the stored value is left alone, so the
  // selection comes back if its posts do.
  const filter = React.useMemo(
    () => reconcileContentFilter(storedFilter, topics),
    [storedFilter, topics]
  )

  const months = React.useMemo(
    () =>
      groupPostsByMonth(filterPosts(filterPostsByQuery(posts, query), filter), tab),
    [posts, query, filter, tab]
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
    setContentTab(projectId, value)
  }

  // Same reason: a query that filters the open day's posts away would leave
  // the deck pointing at a day the page no longer lists.
  const handleQueryChange = (value: string) => {
    setOpenDay(null)
    setQuery(value)
  }

  const handleFilterChange = (value: ContentFilter) => {
    setOpenDay(null)
    setContentFilter(projectId, value)
  }

  const { ref: showAsRef, style: showAsStyle } =
    useSquircleClipPath<HTMLButtonElement>({
      cornerRadius: SHOW_AS_CORNER_RADIUS,
    })
  const { ref: desktopShowAsRef, style: desktopShowAsStyle } =
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
  // Mobile scrolls the complete page within this panel, including its controls.
  // Keep a dedicated mask on that scroller; the desktop month list still owns
  // its narrower reader fade above.
  const { ref: mobileContentRef, onScroll: onMobileContentScroll } =
    useScrollFade({
      axis: "y",
      start: PAGE_FADE_TOP_PX,
      end: PAGE_FADE_BOTTOM_PX,
    })
  // Keyed on the layout and tab as well as the project: each shows a different
  // list, so one of them's offset means nothing in another. Switching tabs
  // therefore restores where you'd been in *that* tab, which falls out of the
  // key changing rather than needing its own handling.
  const { ref: monthsMemoryRef, onScroll: onMonthsMemoryScroll } =
    useScrollMemory(`${projectId}:${view}:${tab}`)

  // Both hooks want the same node and the same scroll events.
  const setMonthsNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      monthsRef(node)
      monthsMemoryRef(node)
    },
    [monthsRef, monthsMemoryRef]
  )
  const handleMonthsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    onMonthsScroll()
    onMonthsMemoryScroll(event)
  }

  // Turns the icon on each tap — see hooks/use-icon-spin.ts for why this is
  // an animation rather than a transition on the inline `rotate`.
  const { ref: iconRef, style: iconStyle, spin } = useIconSpin()
  const {
    ref: desktopIconRef,
    style: desktopIconStyle,
    spin: spinDesktopIcon,
  } = useIconSpin()

  const changeView = () => {
    const index = CONTENT_VIEWS.findIndex((entry) => entry.value === view)
    const next = CONTENT_VIEWS[(index + 1) % CONTENT_VIEWS.length].value
    // Writing to the store is what re-renders this — there's no local copy of
    // the view to keep in step with it. The icon's angle stays local: the spin
    // belongs to the act of switching, not to the state, so a restored view
    // starts unrotated.
    setContentView(projectId, next)
  }
  const cycleMobileView = () => {
    spin()
    changeView()
  }
  const cycleDesktopView = () => {
    spinDesktopIcon()
    changeView()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-dist-xl p-pad-md md:p-pad-2xl">
      {/* The top mobile row stays visible while the tab/search controls and
          month content scroll underneath it. */}
      <div className="flex items-center justify-between gap-dist-md md:hidden">
          <h1 className="text-heading-sm font-display text-text-bold">Content</h1>
          <button
            ref={showAsRef}
            style={showAsStyle}
            type="button"
            onClick={cycleMobileView}
            aria-label={`Showing as ${CONTENT_VIEWS.find((entry) => entry.value === view)?.label} — tap to change`}
            className="flex shrink-0 cursor-pointer items-center gap-dist-md rounded-rad-xmd bg-surface-3 px-pad-md py-pad-xs transition-[background-color,scale] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
          >
            <span className="text-body-lg text-text-subtle">Show as:</span>
            <span className="text-body-lg text-text-bold">
              {CONTENT_VIEWS.find((entry) => entry.value === view)?.label}
            </span>
            <ArrowsClockwise
              ref={iconRef}
              weight="bold"
              style={iconStyle}
              className="size-5 text-icon-bold"
            />
          </button>
      </div>

      <div
        ref={mobileContentRef}
        onScroll={onMobileContentScroll}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-dist-lg overflow-y-auto md:contents",
          HIDE_NATIVE_SCROLLBAR_CLASSNAME,
        )}
      >
        <div className="flex flex-col gap-dist-lg md:hidden">
          <SegmentedControl
            className="w-full"
            value={tab}
            onValueChange={(value) => handleTabChange(value as ContentTab)}
            items={CONTENT_TABS}
          />

          <div className="flex items-center gap-dist-md">
            <ContentSearch
              value={query}
              onValueChange={handleQueryChange}
              defaultOpen
              stayOpen
              className="w-auto flex-1"
            />
            <ContentFilterMenu
              filter={filter}
              onFilterChange={handleFilterChange}
              topics={topics}
            />
          </div>
        </div>

      {/* The search control sits at the header's opposite end, and is what
          the panel's info marker used to be on this page (see the page's
          `showInfoMarker={false}`) — the corner marker had no behavior, this
          does. */}
      <div className="hidden flex-col items-start gap-dist-lg @2xl/section:flex-row @2xl/section:items-center @2xl/section:justify-between md:flex">
        <h1 className="text-heading-md font-display text-text-bold">Content</h1>
        <div className="flex items-center gap-dist-md">
          <ContentSearch value={query} onValueChange={handleQueryChange} />
          <ContentFilterMenu
            filter={filter}
            onFilterChange={handleFilterChange}
            topics={topics}
          />
        </div>
      </div>

      <div className="hidden flex-col gap-dist-md md:flex">
        <div className="flex flex-col items-start gap-dist-md @2xl/section:flex-row @2xl/section:items-center @2xl/section:justify-between">
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
            ref={desktopShowAsRef}
            style={desktopShowAsStyle}
            type="button"
            onClick={cycleDesktopView}
            aria-label={`Showing as ${CONTENT_VIEWS.find((entry) => entry.value === view)?.label} — tap to change`}
            className="flex cursor-pointer items-center gap-dist-md rounded-rad-xmd bg-surface-3 px-pad-md py-pad-xs transition-[background-color,scale] duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
          >
            <span className="text-body-lg text-text-subtle">Show as:</span>
            <span className="text-body-lg text-text-bold">
              {CONTENT_VIEWS.find((entry) => entry.value === view)?.label}
            </span>
            <ArrowsClockwise
              ref={desktopIconRef}
              weight="bold"
              style={desktopIconStyle}
              className="size-5 text-icon-bold"
            />
          </button>
        </div>

        {/* Drafts only: they have no scheduled date, so they group by the day
            they were created (lib/content-grouping.ts's groupingDate) — worth
            saying, since every other tab's chips read as scheduling. Same info
            line shape as the Generate and Generating pages. */}
        {tab === "draft" ? (
          <p className="flex items-center gap-dist-md text-body-md text-text-subtle">
            <Info className="size-4 text-icon-subtle" />
            Drafts sorted on date created
          </p>
        ) : null}
      </div>

      {/* Mobile's panel scroller includes the controls above, so they travel
          with the months under the same edge fade. Desktop keeps this nested
          month reader, where the wider header remains persistent. */}
      {months.length === 0 ? (
        // A search or filter that matched nothing reads differently from a tab
        // that has nothing in it: one is something to correct, the other is
        // just the state of things. The caption names what was narrowing —
        // echoing the query back in bold is what makes it actionable, you can
        // see what you actually typed — while the big line stays the
        // instruction.
        query.trim() !== "" ? (
          <EmptyState
            icon={MagnifyingGlass}
            caption={
              <>
                No matches for{" "}
                {/* Bold, but it stays in the caption's own text-subtle —
                    weight is enough to pick the query out, and darkening it
                    would make the small grey line compete with the heading
                    below it. */}
                <strong className="font-bold">{echoQuery(query)}</strong>
              </>
            }
            title="Check what you typed and try again"
          />
        ) : isContentFilterActive(filter) ? (
          // The export draws the plain tab empty state here, which can't be
          // right once a filter is what emptied the page — it would send you
          // looking for missing posts. Same shape as the search one instead.
          <EmptyState
            icon={FunnelSimple}
            caption="No matches for this filter"
            title="Try another topic or social account"
          />
        ) : (
          <EmptyState
            icon={Eyes}
            caption="Nothing to show here"
            title={EMPTY_STATE_TITLES[tab]}
          />
        )
      ) : view === "kanban" ? (
        <div
          ref={setMonthsNode}
          onScroll={handleMonthsScroll}
          className={cn(
            "flex flex-none flex-col gap-dist-xl md:min-h-0 md:flex-1 md:overflow-y-auto",
            HIDE_NATIVE_SCROLLBAR_CLASSNAME
          )}
        >
          {months.map((month) => (
            <MonthBoard
              key={month.key}
              month={month}
              accounts={accounts}
              activeTopics={activeTopicSet}
              postHref={(post) => `/projects/${projectId}/calendar/${post.id}`}
            />
          ))}
        </div>
      ) : (
        <div
          ref={setMonthsNode}
          onScroll={handleMonthsScroll}
          className={cn(
            "flex flex-none flex-col gap-dist-xl md:min-h-0 md:flex-1 md:overflow-y-auto",
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

      </div>

      {openDay && openEntry ? (
        <DayDeck
          projectId={projectId}
          accounts={accounts}
          activeTopics={activeTopicSet}
          dateLabel={formatDayLabel(openEntry.month, openEntry.day)}
          posts={openEntry.day.posts}
          origin={openDay.origin}
          dayKey={openDay.key}
          keyForPost={(post) => dayKeyForPost(post, tab)}
          onClose={closeDeck}
          onPostsChange={setPosts}
        />
      ) : null}
    </div>
  )
}
