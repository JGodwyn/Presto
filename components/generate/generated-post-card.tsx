"use client"

import * as React from "react"
import Image from "next/image"
import { ArrowClockwise, CalendarDots, Scribble, Trash } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Chip } from "@/components/ui/chip"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { GeneratingPostCard } from "@/components/generate/generating-post-card"
import { PostActionsMenu } from "@/components/generate/post-actions-menu"
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

// Placeholder content — real generation isn't wired up yet, so every card
// shows the same mock post, matching the Figma export literally (same
// convention as GeneratingPostCard's fixed "Generating…" placeholder). Only
// the date is real (GeneratingView owns it, updated via "Add to calendar"
// below) — content/topics stay fixed until generation is wired up.
const PLACEHOLDER_CONTENT =
  "What a book it was. Very practical with lots of steps you can take for your current or next project. It is one of those books you keep by your side. You might need answers to something bothering you on a project. The book can provide just that answer."
const PLACEHOLDER_TOPICS = ["Product design", "UI design", "UX design"]

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

interface GeneratedPostCardProps {
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
  date,
  onDateChange,
  onDelete,
  onTurnToDraft,
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
  // Same pill shape as Chip (rad-md, border-subtle, surface-3) but with its
  // own icon + bold-text content rather than Chip's built-in label styling
  // — a squircle of its own since it has its own corner radius, per the
  // design-tokens rule.
  const { ref: socialRef, style: socialStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: PILL_CORNER_RADIUS })

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

  // Add to calendar: a staged pick (Apply/Cancel, per the calendar's own
  // design-sync/calendar-action-bar export — its Apply=brand/Cancel=
  // brand-secondary sizing maps straight onto Button's existing variants) —
  // pendingDate is scratch state local to the dialog, seeded from the real
  // `date` prop each time it opens, and only committed to the card via
  // onDateChange when Apply is pressed.
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [pendingDate, setPendingDate] = React.useState<Date | undefined>(date)

  // Measures the content paragraph's actual flex-allotted height (while it's
  // still a plain flex-1 box, pre-clamp) and derives how many whole lines of
  // text fit in it, then pins the box to exactly lines*lineHeight and hands
  // the line count to -webkit-line-clamp — a real "…" at a whole line
  // boundary, instead of the previous plain overflow-hidden which cut
  // straight through whatever line happened to sit at the edge.
  //
  // Pinning an explicit height (rather than leaving it flex-1 once clamped)
  // matters: flex-1's leftover space (176px here) is rarely an exact
  // multiple of the line height (24px → 7 lines is only 168px), and
  // -webkit-line-clamp only clips the text — it doesn't shrink the box
  // itself to match, so the leftover 8px of slack let an 8th line's
  // ascenders start rendering into it before the box's own overflow-hidden
  // finally cut it off. Setting `flex: 0 0 auto` overrides the flex-1 class
  // (flex-basis 0% otherwise ignores an explicit height) so the box's real
  // height becomes the exact clamp math, no slack left for a stray line to
  // bleed into.
  //
  // A guarded one-time measurement (not a live ResizeObserver): this only
  // needs to run once, against the pre-clamp flex-allocated height — once
  // `clamp` is set, the paragraph's own box is no longer that reference
  // height (it's now our pinned one), so re-observing it would be measuring
  // itself. React re-invokes a ref callback whose identity changes (the
  // `clamp` dependency below), which is what re-triggers this after the
  // state update — the `if (clamp) return` guard is what stops it there.
  const [clamp, setClamp] = React.useState<{ lines: number; lineHeightPx: number }>()
  const paragraphRef = React.useCallback(
    (node: HTMLParagraphElement | null) => {
      if (!node || clamp) return
      const lineHeightPx = parseFloat(getComputedStyle(node).lineHeight)
      if (!lineHeightPx) return
      const lines = Math.max(1, Math.floor(node.clientHeight / lineHeightPx))
      setClamp({ lines, lineHeightPx })
    },
    [clamp]
  )

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
          flex-basis/flex-grow — without it, overflow-hidden never actually
          gets a chance to clip anything (matters for the first, pre-clamp
          paint below). Once `clamp` is measured, `flex: 0 0 auto` + an
          explicit pixel height take over from flex-1 entirely — see the
          comment above `clamp` for why. */}
      <p
        ref={paragraphRef}
        style={
          clamp
            ? {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: clamp.lines,
                flex: "0 0 auto",
                height: clamp.lines * clamp.lineHeightPx,
              }
            : undefined
        }
        className="min-h-0 flex-1 overflow-hidden text-body-lg text-text-bold"
      >
        {PLACEHOLDER_CONTENT}
      </p>

      <div
        ref={socialRef}
        style={socialStyle}
        className="flex h-7 w-fit shrink-0 items-center gap-dist-sm rounded-rad-md border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 px-pad-sm"
      >
        <Image
          src="/images/generate/linkedin.svg"
          alt=""
          width={16}
          height={16}
        />
        <span className="text-body-md-bold text-text-bold">LinkedIn</span>
      </div>

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
        {PLACEHOLDER_TOPICS.map((topic) => (
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
          onClick={() => {
            setPendingDate(date)
            setPickerOpen(true)
          }}
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
        doesn't need to shape anything. */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          showCloseButton={false}
          clipContent={false}
          popupClassName="w-fit"
          className="gap-0 rounded-none bg-transparent p-0"
        >
          <Calendar
            mode="single"
            selected={pendingDate}
            onSelect={setPendingDate}
            size="lg"
            showActionBar
            onApply={() => {
              if (pendingDate) onDateChange(pendingDate)
              setPickerOpen(false)
            }}
            onCancel={() => setPickerOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
