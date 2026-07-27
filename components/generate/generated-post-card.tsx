"use client"

import * as React from "react"
import { ArrowClockwise, CalendarDots, Scribble, Trash } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Chip } from "@/components/ui/chip"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { GeneratingPostCard } from "@/components/generate/generating-post-card"
import { PostActionsMenu } from "@/components/generate/post-actions-menu"
import {
  SOCIAL_PLATFORM_OPTIONS,
  type SocialPlatform,
} from "@/components/generate/social-platform-options"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"

const CARD_CORNER_RADIUS = 16 // rad-lg
const PILL_CORNER_RADIUS = 8 // rad-md — same as Chip's own corner radius

// Same pace as GeneratingView's own CARD_REVEAL_MS — regenerating a single
// card is standing in for the same "one post takes about this long" placeholder
// timing, just scoped to one card instead of the whole batch.
const REGENERATE_MS = 1200

// How wide a fade-to-transparent runs in from each side of the topics row —
// same masking technique as the calendar's skip-dates carousel
// (generate-calendar-column.tsx's EDGE_FADE_PX): a CSS mask, not overflow,
// so a chip scrolling through fades out instead of getting sliced by a hard
// edge. Sized to this card's own p-pad-lg (16px) rather than copying the
// carousel's 24px verbatim — the row below bleeds out to that exact padding
// and no further, so a wider fade would push resting chips past the card's
// true inner edge.
const EDGE_FADE_PX = 16
const EDGE_FADE_MASK = `linear-gradient(to right, transparent, black ${EDGE_FADE_PX}px, black calc(100% - ${EDGE_FADE_PX}px), transparent)`

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

// Cross-browser: Chrome/Safari ship caretRangeFromPoint, Firefox ships the
// newer caretPositionFromPoint — both resolve a screen point to a text
// node + character offset, which is what places the cursor at the actual
// double-click position rather than always at the start/end of the text.
function getCaretOffsetFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(x, y)
    return position ? { node: position.offsetNode, offset: position.offset } : null
  }
  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(x, y)
    return range ? { node: range.startContainer, offset: range.startOffset } : null
  }
  return null
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

interface GeneratedPostCardProps {
  content: string
  // Double-tap/double-click anywhere on the card that isn't itself a button
  // enters a quick-edit mode on this text in place — see handleCardDoubleClick.
  onContentChange: (content: string) => void
  topics: string[]
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
  // Seeded from whichever account was selected on the Generate page;
  // tapping the pill below cycles it independently per card from there.
  social: SocialPlatform
  onSocialChange: (social: SocialPlatform) => void
  // Forwarded straight through to the GeneratingPostCard this renders in
  // place of itself while regenerating — same live DialKit values
  // GeneratingView already threads into the "real" active generating card.
  textOpacityMin: number
  textOpacityDuration: number
  rotationEnabled: boolean
  rotationDuration: number
  borderOpacityMin: number
  borderOpacityDuration: number
}

// What a GeneratingPostCard turns into once its post finishes — from the
// Figma "Generated post card" export (design-sync/generated-post-card).
// Add to calendar opens a date-picker dialog; Delete/Regenerate are wired to
// GeneratingView's per-post state (delete/date) or fully local (regenerate,
// a transient visual toggle with nothing to persist).
export function GeneratedPostCard({
  content,
  onContentChange,
  topics,
  date,
  onDateChange,
  onDelete,
  onTurnToDraft,
  social,
  onSocialChange,
  textOpacityMin,
  textOpacityDuration,
  rotationEnabled,
  rotationDuration,
  borderOpacityMin,
  borderOpacityDuration,
}: GeneratedPostCardProps) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: CARD_CORNER_RADIUS,
  })
  // Falls back to the first option if `social` somehow doesn't match any of
  // them (shouldn't happen, but findIndex returning -1 would otherwise wrap
  // "cycle to next" around to the *last* option instead of the first).
  const socialIndex = Math.max(
    0,
    SOCIAL_PLATFORM_OPTIONS.findIndex((option) => option.value === social)
  )
  const currentSocial = SOCIAL_PLATFORM_OPTIONS[socialIndex]
  const handleCycleSocial = () => {
    const nextIndex = (socialIndex + 1) % SOCIAL_PLATFORM_OPTIONS.length
    onSocialChange(SOCIAL_PLATFORM_OPTIONS[nextIndex].value)
  }
  // Same pill shape as Chip (rad-md, border-subtle, surface-3) but with its
  // own icon + bold-text content rather than Chip's built-in label styling
  // — a squircle of its own since it has its own corner radius, per the
  // design-tokens rule. A real button now (tap-to-cycle), not a plain div.
  const { ref: socialRef, style: socialStyle } =
    useSquircleClipPath<HTMLButtonElement>({ cornerRadius: PILL_CORNER_RADIUS })

  // Regenerate is purely a local visual toggle — nothing about the post
  // actually changes (no real generation to re-run yet), it just shows the
  // generating placeholder again for a beat and flips back, standing in for
  // "this post is being redone."
  const [isRegenerating, setIsRegenerating] = React.useState(false)
  React.useEffect(() => {
    if (!isRegenerating) return
    const id = setTimeout(() => setIsRegenerating(false), REGENERATE_MS)
    return () => clearTimeout(id)
  }, [isRegenerating])

  // Add to calendar / Change date: commits immediately on every date click
  // (per direct feedback — better for clicking through several dates in a
  // row than a separate Apply step) and closes right after, so there's no
  // pending/staged selection to track here at all — Calendar's own
  // `selected` is just the real `date` prop, and onSelect writes straight
  // through to onDateChange.
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

  // Regenerating swaps this component's entire output for GeneratingPostCard
  // — same footprint (that card is already h-92 w-full min-w-70 on its own),
  // just a different key so React genuinely remounts rather than diffing two
  // unrelated trees in place, which is what gives each swap its own quick
  // starting: fade below (a bare prop/className update wouldn't retrigger
  // starting-style at all).
  if (isRegenerating) {
    return (
      <div
        key="regenerating"
        className="transition-[opacity,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]"
      >
        <GeneratingPostCard
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
      className="flex h-92 w-full min-w-70 flex-col gap-dist-md rounded-rad-lg border-[length:var(--stroke-xl)] border-border-subtle bg-surface-4 p-pad-lg transition-[opacity,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]"
      onDoubleClick={handleCardDoubleClick}
    >
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-dist-sm">
          {date ? (
            <CalendarDots className="size-5 text-icon-subtle" weight="bold" />
          ) : (
            <Scribble className="size-5 text-icon-subtle" weight="bold" />
          )}
          <span className="text-body-lg-bold text-text-bold">
            {date ? formatDate(date) : "Draft"}
          </span>
        </div>
        {date ? (
          <PostActionsMenu onTurnToDraft={onTurnToDraft} onDelete={onDelete} />
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

      {/* Tap-to-cycle (per direct feedback) — each tap advances to the next
          platform in SOCIAL_PLATFORM_OPTIONS and wraps back to the first,
          same hover tint recipe as SelectPill's own capsule trigger since
          this is now the same kind of "click to change" pill. */}
      <button
        ref={socialRef}
        style={socialStyle}
        type="button"
        onClick={handleCycleSocial}
        aria-label={`Change social platform (currently ${currentSocial.label})`}
        className="flex h-7 w-fit shrink-0 cursor-pointer items-center gap-dist-sm rounded-rad-md border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 px-pad-sm transition-colors duration-150 ease-out hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)]"
      >
        {currentSocial.icon}
        <span className="text-body-md-bold text-text-bold">
          {currentSocial.label}
        </span>
      </button>

      {/* Horizontally scrolling, not wrapping — a wider topics list no
          longer grows the row's height, keeping every card's height
          identical regardless of how many topics a post ends up with.
          -mx-4/px-4 (16px, matching EDGE_FADE_PX/p-pad-lg): the fade mask
          below fades against the row's own boundary, which is exactly where
          a resting (unscrolled) chip's own edge sits too — this bleeds the
          row out to the card's true inner edge so the fade buffers resting
          content on both sides instead of dimming it (same fix as the
          calendar carousel's px-6/-ml-6, scaled down to this card's smaller
          padding budget). */}
      <div
        style={{ maskImage: EDGE_FADE_MASK, WebkitMaskImage: EDGE_FADE_MASK }}
        className={cn(
          "-mx-4 flex h-7 shrink-0 items-center gap-dist-sm overflow-x-auto px-4",
          HIDE_NATIVE_SCROLLBAR_CLASSNAME
        )}
      >
        {topics.map((topic) => (
          <Chip key={topic} size="md" selected={false} className="shrink-0">
            {topic}
          </Chip>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-dist-sm">
        <Button
          variant={date ? "brand" : "success"}
          size="sm"
          className="flex-1"
          onClick={() => setPickerOpen(true)}
        >
          {date ? "Change date" : "Add to calendar"}
        </Button>
        <Button
          variant="brand-secondary"
          size="icon-sm"
          aria-label="Regenerate post"
          onClick={() => setIsRegenerating(true)}
        >
          <ArrowClockwise weight="bold" />
        </Button>
      </div>

      {/* Just the calendar (design-sync/calendarwithactionbar) — no extra
        title/padding/card wrapper of this dialog's own, so Calendar's own
        card (border, shadow, p-pad-md) reads as the only chrome instead of
        nesting inside a second one. showCloseButton is off since the design
        has no X (Cancel already closes it); popupClassName clears the
        default w-80/padding/background so the Popup just hugs Calendar's own
        size="lg" footprint (320px, matching the export exactly — no longer
        needing the smaller "md" workaround from when this dialog had its
        own 32px of padding eating into the available width). clipContent is
        off too — DialogContent's own clip-path (still applied even with the
        className overrides above, since it's a style prop, not a class) was
        clipping Calendar's own drop shadow at almost the same boundary it
        was supposed to soften, reading as an abrupt cutoff rather than a
        shadow. Calendar already draws its own card/shadow, so this wrapper
        doesn't need to shape anything.
        onSelect commits straight to onDateChange and closes the dialog in
        the same click — no Apply step (per direct feedback: better UX when
        clicking through several dates is the common case), so `selected`
        is just the real `date` prop rather than a staged local copy. */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          showCloseButton={false}
          clipContent={false}
          popupClassName="w-fit"
          className="gap-0 rounded-none bg-transparent p-0"
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => {
              if (newDate) onDateChange(newDate)
              setPickerOpen(false)
            }}
            size="lg"
            showActionBar
            onCancel={() => setPickerOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
