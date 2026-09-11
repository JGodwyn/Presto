"use client"

import * as React from "react"
import {
  ArrowClockwise,
  CalendarDots,
  PaperPlaneTilt,
  Scribble,
  SpinnerGap,
  Trash,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { GeneratingPostCard } from "@/components/generate/generating-post-card"
import { PostActionsMenu } from "@/components/generate/post-actions-menu"
import { DateTimePickerDialog } from "@/components/shared/date-time-picker-dialog"
import { PostAccountPill } from "@/components/shared/post-account-pill"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { getCaretOffsetFromPoint } from "@/lib/caret"
import { formatDate } from "@/lib/format-date"
import { formatClockTime } from "@/lib/time-of-day"
import type { PostAccount, PostAccountTarget } from "@/lib/post-account"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"

const CARD_CORNER_RADIUS = 16 // rad-lg

// How far the status/account/topics row dissolves at each end, once there is
// actually something left to scroll to there — the same scroll-aware fade the
// Kanban card uses (hooks/use-scroll-fade.ts), not the static mask this row
// used to carry. Both edges are this card's own p-pad-lg, since the row bleeds
// out to exactly that padding and no further. Kept in sync by hand with the
// row's own px-4/-mx-4 (Tailwind needs literals).
const EDGE_FADE_PX = 16

// Same fade-instead-of-hard-cutoff idea as the topics row above, applied
// vertically to the content box: it scrolls (mouse wheel/trackpad/drag) the
// full post text rather than clamping it to a fixed number of lines with an
// ellipsis. Unlike the topics row/calendar carousel's fixed-height mask,
// each edge's fade height is the *actual remaining scroll distance at that
// edge, capped at this max* — not a binary on/off switch. A binary switch
// (an earlier version of this) had a dead zone: right up until the last
// pixel of scroll, the full-height fade still applied even though there
// was almost nothing left to reveal, so the fade visually "bled into" text
// that was effectively already at rest (per direct feedback). Scaling the
// fade down to whatever's actually left to scroll — 0 at true rest, up to
// the max below once there's at least that much room — makes that
// impossible: the fade can never cover more than the distance still
// scrollable, at either edge, so it never dims text with nowhere left to
// go. See updateScrollFade below.
//
// Bottom is taller than top (per direct feedback, twice: "more prominent,
// especially at the bottom") — it's carrying more of the job here, since
// it's the only thing (short of actually scrolling) that signals a card
// has more content at all; the top fade only ever matters once you're
// already mid-scroll and already know that.
const CONTENT_FADE_TOP_PX = 32
const CONTENT_FADE_BOTTOM_PX = 72
const CONTENT_TEXT_CLASSNAME = "text-body-lg text-text-bold whitespace-pre-wrap"

function buildContentFadeMask(topFadePx: number, bottomFadePx: number): string | undefined {
  if (topFadePx <= 0 && bottomFadePx <= 0) return undefined
  const topStop = topFadePx > 0 ? `transparent, black ${topFadePx}px` : "black 0"
  const bottomStop = bottomFadePx > 0 ? `black calc(100% - ${bottomFadePx}px), transparent` : "black 100%"
  return `linear-gradient(to bottom, ${topStop}, ${bottomStop})`
}



interface GeneratedPostCardProps {
  content: string
  // Double-tap/double-click anywhere on the card that isn't itself a button
  // enters a quick-edit mode on this text in place — see handleCardDoubleClick.
  onContentChange: (content: string) => void
  topics: string[]
  // The project's current Instructions topics. A post's topics are a snapshot
  // taken at generation time with no foreign key behind them, so one deleted
  // since then still sits on the post — anything not in this set renders
  // retired rather than disappearing (the post really was written about it).
  // Optional: the Generating page has no reason to have fetched them, and
  // every topic there was live seconds ago by definition.
  activeTopics?: Set<string>
  // undefined = draft (design-sync/ChangesToGenerateCard's "Draft" state) —
  // not yet scheduled for a specific date. Set once "Add to calendar" (draft)
  // or "Change date" (scheduled) applies a pick.
  date: Date | undefined
  onDateChange: (date: Date) => void
  // Exit animation (reversing the entrance) plays on the wrapper GeneratingView
  // renders around this card — Delete here just reports the click upward,
  // it doesn't own the timing.
  onDelete: () => void
  // Scheduled-only (the draft state has no scheduling to undo) — sends the
  // post back to date: undefined.
  onTurnToDraft: () => void
  // Adds an "Open up" row to the actions menu, for callers that have a page to
  // send the post to. Left out where there isn't one.
  onOpen?: () => void
  // Rendered at the head of the account/topics row when there is something
  // wrong with this post — overdue, or a publish that failed. A slot rather
  // than a `post` prop: this card takes resolved primitives (`account` is
  // resolved by the caller too), and the one caller that has a whole Post to
  // hand is the only one that needs it.
  statusMarker?: React.ReactNode
  // Adds a "Publish now" row. Left out where the post can't go out
  // (canAttemptPublish, lib/post-publish.ts) and where the caller has no
  // publishing path at all — the Generating page passes nothing, since a post
  // that was written seconds ago hasn't been read yet, let alone approved.
  // The caller owns the confirmation: this card never sends anything itself.
  onPublish?: () => void
  // Shows the publish row disabled instead, for a platform whose publisher is
  // built but switched off. See PostActionsMenu, which owns the treatment.
  publishComingSoon?: boolean
  // Runs a real generation against this post's own brief and writes the new
  // text back through `content` (GeneratingView owns both the server call and
  // the state) — this card only owns the placeholder it shows while that's in
  // flight, so it just awaits whatever this resolves to.
  onRegenerate: () => Promise<void>
  // This post has gone out and can no longer be changed here (isPostLocked,
  // lib/post-publish.ts). The provider owns the copy people are reading, so
  // every control that would make this card and the live post disagree is
  // shut: no double-tap editing, no date picker, no account switching, and no
  // Turn-to-draft row in the menu. Delete stays — it removes this app's record
  // and says so.
  locked?: boolean
  // When it went out, which takes the header's date slot. A post published
  // straight from a draft never gets a `scheduled_for`, so without this its
  // card reads "Draft" above something that is live. Absent on a post that is
  // live-but-unrecorded (the `record_failed:` marker), where the moment
  // genuinely isn't known — the status chip is what says so there.
  publishedAt?: Date
  // Regenerate's replacement on a locked post: it drafts a *new* post rather
  // than rewriting the published one (draftFollowUpPost). Optional, so a
  // caller with nowhere to put a new draft simply gets no button.
  onDraftFollowUp?: () => Promise<void>
  // A reroll started somewhere other than this card's own button — the
  // too-long-to-switch dialog is the only one today. Without it that reroll
  // shows no feedback at all (this card owns the placeholder, and never learns
  // the call went out) and slips past the re-entrancy guard below, so the
  // card's own button could fire a second one alongside it.
  regenerating?: boolean
  // Seeded from whichever account was selected on the Generate page;
  // tapping the pill below cycles it independently per card from there.
  // The resolved account this post goes out as — a connected account's own
  // name where there is one, otherwise the platform label, or "Try out"
  // (lib/post-account.ts). The pill names *that*, not the bare platform.
  account: PostAccount
  // Where a tap on the pill goes, or null when there's nowhere to go — which
  // now only happens with no connected accounts at all, since "Try out" is
  // itself a cycle position. A null makes the pill a plain span (no cursor,
  // no hover tint, not a tab stop): a control that visibly invites a tap and
  // does nothing is worse than no control. Computed by the caller
  // (nextPostAccount), the only side that knows what this project connected.
  nextAccount: PostAccountTarget | null
  onSocialChange: (target: PostAccountTarget) => void
  // Forwarded straight through to the GeneratingPostCard this renders in
  // place of itself while regenerating. Optional, and these defaults are that
  // component's own frozen values repeated — so no call site has to invent six
  // numbers it never intends to change, and nothing currently overrides them.
  textOpacityMin?: number
  textOpacityDuration?: number
  rotationEnabled?: boolean
  rotationDuration?: number
  borderOpacityMin?: number
  borderOpacityDuration?: number
  // Merged last, so a caller can override the card's own size — the deck on
  // the Content page renders it at that export's dimensions rather than the
  // Generate grid's, which are pinned to GeneratingPostCard's.
  className?: string
}

// What a GeneratingPostCard turns into once its post finishes — from the
// Figma "Generated post card" export (design-sync/generated-post-card).
// Add to calendar opens a date-picker dialog; Delete/Regenerate both run
// through GeneratingView's per-post state and server actions — this card owns
// only the placeholder shown while a regeneration is in flight.
export function GeneratedPostCard({
  content,
  onContentChange,
  topics,
  activeTopics,
  date,
  onDateChange,
  onDelete,
  onTurnToDraft,
  onOpen,
  statusMarker,
  onPublish,
  publishComingSoon,
  onRegenerate,
  locked = false,
  publishedAt,
  onDraftFollowUp,
  regenerating = false,
  account,
  nextAccount,
  onSocialChange,
  textOpacityMin = 0.4,
  textOpacityDuration = 0.5,
  rotationEnabled = true,
  rotationDuration = 0.8,
  borderOpacityMin = 0.25,
  borderOpacityDuration = 0.35,
  className,
}: GeneratedPostCardProps) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: CARD_CORNER_RADIUS,
  })
  const { ref: rowRef, onScroll: onRowScroll } = useScrollFade({
    axis: "x",
    start: EDGE_FADE_PX,
    end: EDGE_FADE_PX,
  })

  // What the header line reports. Once a post is out, the moment that matters
  // is when it *went* out — and a post published straight from a draft has no
  // `scheduled_for` at all, so reading `date` alone would put "Draft" above
  // something live (FOLLOWUPS §5c, the same defect the post's own page had).
  const headerDate = publishedAt ?? date

  // The placeholder stands in for this card for exactly as long as the real
  // generation call is in flight — no timer of its own, so a slow model keeps
  // it up and a fast one drops it the moment new text lands. Failures are
  // reported (as a Toast) by whoever owns onRegenerate, and this card simply
  // reappears with its original content, which is still the truth.
  const [isRegenerating, setIsRegenerating] = React.useState(false)
  // Either source keeps the placeholder up and the button shut.
  const busy = isRegenerating || regenerating
  const isMountedRef = React.useRef(true)
  React.useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleRegenerate = async () => {
    if (busy) return
    setIsRegenerating(true)
    try {
      await onRegenerate()
    } finally {
      // Deleting a post mid-regenerate unmounts this card while the call is
      // still out — nothing left to flip back.
      if (isMountedRef.current) setIsRegenerating(false)
    }
  }

  // Drafting a follow-up deliberately does *not* raise the placeholder above.
  // Nothing about this card is being rewritten — a new post is being written
  // somewhere else — so swapping this one for a "generating" shell would say
  // the opposite of what is happening. The button carries the wait instead.
  const [isDrafting, setIsDrafting] = React.useState(false)
  const handleDraftFollowUp = async () => {
    if (isDrafting || !onDraftFollowUp) return
    setIsDrafting(true)
    try {
      await onDraftFollowUp()
    } finally {
      if (isMountedRef.current) setIsDrafting(false)
    }
  }

  // Add to calendar / Change date — the shared picker
  // (components/shared/date-time-picker-dialog.tsx, also used by the
  // post-details page), which owns the whole commit story: a date click
  // writes through and closes, and the time inside it writes through on its
  // own. Nothing is staged here; `date` is the real prop either way.
  const [pickerOpen, setPickerOpen] = React.useState(false)

  // Quick-edit: double-clicking anywhere on the card that isn't a button
  // (handleCardDoubleClick) swaps the content box for a plain-styled
  // textarea in place. `draft` is a local scratch copy — only committed via
  // onContentChange on blur/Enter, so keystrokes don't fire a save each
  // time. caretOffsetRef carries the click's resolved text-offset from the
  // double-click handler to the focus effect below (a ref, not state — it's
  // read exactly once per edit session, right after the textarea mounts).
  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(content)
  // Shared between the view div and the edit textarea (only one is ever
  // mounted at a time) — both scroll-fade tracking and the double-click
  // caret math need whichever one is currently rendered.
  const contentRef = React.useRef<HTMLDivElement | HTMLTextAreaElement | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const caretOffsetRef = React.useRef(0)
  // Captured from the view div at double-click time so the textarea that
  // replaces it (a fresh element, native scrollTop 0) opens at the same
  // scroll position instead of jumping to the top — see
  // handleCardDoubleClick and the focus effect below.
  const pendingScrollTopRef = React.useRef(0)

  const [topFadePx, setTopFadePx] = React.useState(0)
  const [bottomFadePx, setBottomFadePx] = React.useState(0)
  const updateScrollFade = React.useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const maxScrollTop = el.scrollHeight - el.clientHeight
    setTopFadePx(Math.max(0, Math.min(CONTENT_FADE_TOP_PX, el.scrollTop)))
    setBottomFadePx(Math.max(0, Math.min(CONTENT_FADE_BOTTOM_PX, maxScrollTop - el.scrollTop)))
  }, [])

  // Recomputes on mount/edit-mode-swap and whenever the text itself changes
  // (either can flip whether the box overflows at all) — useLayoutEffect so
  // this lands before paint, not after, which is what keeps a freshly
  // mounted card from ever flashing the wrong fade state for a frame.
  React.useLayoutEffect(() => {
    updateScrollFade()
  }, [isEditing, content, draft, updateScrollFade])

  // Also covers width/height changes that aren't content-driven — a window
  // resize reflowing the grid can change how many lines wrap without the
  // text itself changing.
  React.useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const observer = new ResizeObserver(updateScrollFade)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isEditing, updateScrollFade])

  // Runs before paint (see above) so the caret/scroll restore below and the
  // fade recompute happen in the same frame the textarea replaces the div —
  // a plain useEffect would let the textarea render at scrollTop 0 first,
  // which is the exact jump-to-top this is fixing.
  React.useLayoutEffect(() => {
    if (!isEditing) return
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    const offset = Math.min(caretOffsetRef.current, textarea.value.length)
    textarea.setSelectionRange(offset, offset)
    textarea.scrollTop = pendingScrollTopRef.current
    updateScrollFade()
  }, [isEditing, updateScrollFade])

  const handleCardDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isEditing) return
    // The one control that has no visible affordance to remove, so the lock
    // has to be enforced here: a published post's text is not editable,
    // because editing it changes nothing about what is public.
    if (locked) return
    // Every existing action on this card (delete, the "..." menu, the
    // social pill, add-to-calendar/change-date, regenerate) is a <button> —
    // a single check covers all of them rather than enumerating each one,
    // and naturally keeps working if a future action is added the same way.
    if ((event.target as HTMLElement).closest("button")) return

    // Resolves the click to a real position within the text where possible
    // (see getCaretOffsetFromPoint) so the cursor lands where the user
    // actually double-clicked, not always at the start/end — falls back to
    // the end of the text for a double-click that landed elsewhere on the
    // card (e.g. the header padding), same as clicking into the end of a
    // plain input.
    const caret = getCaretOffsetFromPoint(event.clientX, event.clientY)
    caretOffsetRef.current =
      caret && contentRef.current?.contains(caret.node) ? caret.offset : content.length
    pendingScrollTopRef.current = contentRef.current?.scrollTop ?? 0

    // The double-click's native "select the word under the cursor" would
    // otherwise flash briefly before the textarea mounts in its place.
    window.getSelection()?.removeAllRanges()
    setDraft(content)
    setIsEditing(true)
  }

  const commitEdit = () => {
    setIsEditing(false)
    const trimmed = draft.trim()
    // An empty save would fail the DB's own non-empty constraint anyway —
    // silently reverting to the last real content reads better than a
    // save-error Toast for what's almost always an accidental select-all-delete.
    if (trimmed && trimmed !== content) onContentChange(trimmed)
  }

  const handleContentKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      commitEdit()
    } else if (event.key === "Escape") {
      event.preventDefault()
      setIsEditing(false)
    }
  }

  // Regenerating swaps this component's entire output for GeneratingPostCard,
  // with a different key so React genuinely remounts rather than diffing two
  // unrelated trees in place, which is what gives each swap its own quick
  // starting: fade below (a bare prop/className update wouldn't retrigger
  // starting-style at all).
  //
  // `className` goes through to the placeholder as well: that card matches
  // this one's default footprint on its own, but a caller that resizes this
  // card (the Content deck's h-98/w-68) has to resize both, or the card
  // visibly changes size the moment it stops being a placeholder.
  if (busy) {
    return (
      <div
        key="regenerating"
        className="transition-[opacity,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]"
      >
        <GeneratingPostCard
          className={className}
          textOpacityMin={textOpacityMin}
          textOpacityDuration={textOpacityDuration}
          rotationEnabled={rotationEnabled}
          rotationDuration={rotationDuration}
          borderOpacityMin={borderOpacityMin}
          borderOpacityDuration={borderOpacityDuration}
        />
      </div>
    )
  }

  return (
    <div
      key="generated"
      ref={ref}
      style={style}
      // h-92 — fixed to match GeneratingPostCard exactly, so a card doesn't
      // change height the moment it turns from one into the other. w-full
      // (grid cell) rather than a fixed width — same width as
      // GeneratingPostCard because both now simply fill whatever column the
      // shared grid (generating-view.tsx) gives them. Every row below is
      // shrink-0 (its own intrinsic height, non-negotiable) except the
      // content paragraph, which is flex-1 — it's the one thing that
      // actually absorbs the fixed height, so the browser's own flex math
      // sizes it exactly right regardless of how tall the other rows truly
      // render, rather than a hand-computed pixel budget (tried first — came
      // out a few px short, and a flex-col with everything free to shrink
      // quietly compressed *every* row to compensate, including the
      // paragraph, cutting its last line off mid-descender). The same quick
      // starting: fade as the regenerating branch above plays every time
      // this key remounts (including back from a regenerate) — it also
      // plays on the very first real reveal, nested inside GeneratingView's
      // own entrance fade on the wrapping div, which is harmless (same curve,
      // same 0→1 bounds).
      className={cn(
        "flex h-92 w-full min-w-70 flex-col gap-dist-md rounded-rad-lg border-[length:var(--stroke-xl)] border-border-subtle bg-surface-4 p-pad-lg transition-[opacity,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]",
        className
      )}
      onDoubleClick={handleCardDoubleClick}
    >
      {/* gap-dist-md so the time never sits flush against the actions
          button — justify-between alone leaves them touching the moment the
          date grows enough to fill the row. */}
      <div className="flex shrink-0 items-center justify-between gap-dist-md">
        {/* min-w-0 so the date below can actually shrink: a flex item's
            automatic minimum is its content, which would otherwise push the
            actions button out of the card instead of truncating. */}
        <div className="flex min-w-0 items-center gap-dist-sm">
          {headerDate ? (
            publishedAt ? (
              <PaperPlaneTilt className="size-5 shrink-0 text-icon-subtle" weight="bold" />
            ) : (
              <CalendarDots className="size-5 shrink-0 text-icon-subtle" weight="bold" />
            )
          ) : (
            <Scribble className="size-5 shrink-0 text-icon-subtle" weight="bold" />
          )}
          {/* Date • time. The date keeps the header's weight; the time is
              plain body-lg in text-subtle beside it, so the pair reads as one
              line with the date leading it.

              It fits now that the current year is dropped
              (lib/format-date.ts): at this card's narrowest — the day deck's
              272px, whose header has 232px — "Aug 28 • 4:32 PM" leaves room
              beside the actions button where "Aug 28, 2026 • 4:32 PM" would
              have run 4px over. A date in another year still can, and
              truncates, per direct request: it's the half that can lose its
              tail and still say what it is, where a clipped "4:32 P…" says
              nothing. */}
          <span className="flex min-w-0 items-baseline gap-dist-sm">
            <span className="truncate text-body-lg-bold text-text-bold">
              {headerDate ? formatDate(headerDate) : "Draft"}
            </span>
            {headerDate ? (
              <>
                <span aria-hidden className="shrink-0 text-body-lg text-text-subtle">
                  •
                </span>
                <span className="shrink-0 text-body-lg text-text-subtle">
                  {formatClockTime(headerDate)}
                </span>
              </>
            ) : null}
          </span>
        </div>
        {/* A draft has no scheduling to undo, so its menu is Open up + Delete
            — but it only becomes a menu at all once there's somewhere to open
            it to. Without that (the Generating page), a draft keeps the plain
            Delete button the export gives it. */}
        {headerDate || onOpen || onPublish || publishComingSoon ? (
          <PostActionsMenu
            onPublish={onPublish}
            publishComingSoon={publishComingSoon}
            onOpen={onOpen}
            onTurnToDraft={date && !locked ? onTurnToDraft : undefined}
            onDelete={onDelete}
          />
        ) : (
          <Button
            variant="danger"
            size="icon-sm"
            aria-label="Delete post"
            onClick={onDelete}
          >
            <Trash weight="bold" />
          </Button>
        )}
      </div>

      {/* min-h-0 overrides the flex default of min-height:auto, which would
          otherwise keep this item at its full content height regardless of
          flex-basis/flex-grow — without it there'd be nothing for
          overflow-y-auto to actually clip/scroll against. */}
      {isEditing ? (
        <textarea
          ref={(node) => {
            textareaRef.current = node
            contentRef.current = node
          }}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleContentKeyDown}
          onBlur={commitEdit}
          onScroll={updateScrollFade}
          style={{
            maskImage: buildContentFadeMask(topFadePx, bottomFadePx),
            WebkitMaskImage: buildContentFadeMask(topFadePx, bottomFadePx),
          }}
          className={cn(
            "min-h-0 flex-1 resize-none bg-transparent outline-none",
            CONTENT_TEXT_CLASSNAME,
            HIDE_NATIVE_SCROLLBAR_CLASSNAME
          )}
        />
      ) : (
        <div
          ref={(node) => {
            contentRef.current = node
          }}
          onScroll={updateScrollFade}
          style={{
            maskImage: buildContentFadeMask(topFadePx, bottomFadePx),
            WebkitMaskImage: buildContentFadeMask(topFadePx, bottomFadePx),
          }}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            CONTENT_TEXT_CLASSNAME,
            HIDE_NATIVE_SCROLLBAR_CLASSNAME
          )}
        >
          {content}
        </div>
      )}

      {/* Status, account and topics share one row (per direct request), and
          the *whole* row scrolls — not just the topics within it, which is
          what this used to do. With only the topics scrolling, everything
          ahead of them held its width and squeezed them into whatever was
          left (65px on the day deck's 272px card), so the one part that could
          move was the one part too small to grab. Scrolling the row means the
          status chip and the account pill move out of the way instead.

          The -mx-4/px-4 pair is what lets content scroll out to the card's
          true edges rather than stopping at its padding: the row bleeds by
          exactly the card's own p-pad-lg and pads itself back by the same, so
          nothing moves at rest. */}
      <div
        ref={rowRef}
        onScroll={onRowScroll}
        className={cn(
          "-mx-4 flex h-7 shrink-0 items-center gap-dist-sm overflow-x-auto px-4",
          HIDE_NATIVE_SCROLLBAR_CLASSNAME
        )}
      >
        {statusMarker}
        {/* Tap-to-cycle (per direct feedback), but only between accounts this
            project has actually connected — see `nextAccount` above for why
            it degrades to a plain span rather than a dead button. The hover
            tint is SelectPill's own capsule recipe, since a cycling pill is
            the same kind of "click to change" control.

            max-w-40 + truncate: the label is an account name, which is user
            data of no fixed length, and a very long one would otherwise push
            every topic past the end of a row nobody would think to scroll
            that far. */}
        <PostAccountPill
          account={account}
          // A published post goes out as whoever it went out as. Passing null
          // is what makes the pill a plain span rather than a dead button —
          // it still names the account, it just no longer offers to change it.
          nextAccount={locked ? null : nextAccount}
          onSelect={onSocialChange}
          className="max-w-40 shrink-0"
        />

        {/* In the row rather than wrapping, so a wider topics list never grows
            the card's height — every card stays the same height regardless of
            how many topics a post ends up with. */}
        {topics.map((topic) => (
          <Chip
            key={topic}
            size="md"
            selected={false}
            retired={activeTopics ? !activeTopics.has(topic) : false}
            // max-w-none undoes Chip's own max-w-full, and it is the whole fix
            // for topics vanishing on a narrow card. Capped at 100% of this
            // row, a chip *shrinks to fit* instead of overflowing — so the row
            // never has anything to scroll, the fade never engages, and the
            // label truncates away. On the day deck's 272px card that left
            // roughly 40px and rendered as an empty pill. Hugging its label is
            // what lets the row overflow, and therefore scroll, at all.
            className="max-w-none shrink-0"
          >
            {topic}
          </Chip>
        ))}
      </div>

      {/* A locked card's row collapses to one button, and the date control is
          gone rather than disabled: the post is out, so there is no date left
          to set and a greyed "Change date" would only invite a click that can
          never do anything. Regenerate keeps its place but changes what it
          means — it drafts a follow-up (a new post) instead of rewriting one
          that is already public. With nowhere to put that draft
          (`onDraftFollowUp` unset) the row disappears entirely. */}
      {locked ? (
        onDraftFollowUp ? (
          <div className="flex shrink-0 items-center gap-dist-sm">
            <Button
              variant="brand"
              size="sm"
              className="flex-1"
              disabled={isDrafting}
              onClick={() => void handleDraftFollowUp()}
            >
              {isDrafting ? (
                <SpinnerGap weight="bold" className="animate-spin" />
              ) : (
                <ArrowClockwise weight="bold" />
              )}
              {isDrafting ? "Regenerating…" : "Regenerate"}
            </Button>
          </div>
        ) : null
      ) : (
        <div className="flex shrink-0 items-center gap-dist-sm">
          <Button
            variant={date ? "brand" : "success"}
            size="sm"
            cornerRadius={12}
            mobileCornerRadius={12}
            mobileCornerSmoothing={0.5}
            className="flex-1 max-md:min-h-[var(--pad-2xl)] max-md:min-w-0 max-md:rounded-rad-xmd"
            onClick={() => setPickerOpen(true)}
          >
            {date ? "Change date" : "Add to calendar"}
          </Button>
          <Button
            variant="brand-secondary"
            size="icon-sm"
            aria-label="Regenerate post"
            onClick={() => void handleRegenerate()}
          >
            <ArrowClockwise weight="bold" />
          </Button>
        </div>
      )}

      <DateTimePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        date={date}
        onDateChange={onDateChange}
      />
    </div>
  )
}
