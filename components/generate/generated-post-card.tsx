"use client"

import * as React from "react"
import Image from "next/image"
import { ArrowClockwise, CalendarDots, Trash } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"

const CARD_CORNER_RADIUS = 16 // rad-lg
const PILL_CORNER_RADIUS = 8 // rad-md — same as Chip's own corner radius

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
// convention as GeneratingPostCard's fixed "Generating…" placeholder).
const PLACEHOLDER_DATE = "July 5, 2026"
const PLACEHOLDER_CONTENT =
  "What a book it was. Very practical with lots of steps you can take for your current or next project. It is one of those books you keep by your side. You might need answers to something bothering you on a project. The book can provide just that answer."
const PLACEHOLDER_TOPICS = ["Product design", "UI design", "UX design"]

// What a GeneratingPostCard turns into once its post finishes — from the
// Figma "Generated post card" export (design-sync/generated-post-card).
// Delete/Add to calendar/Regenerate render but aren't wired to anything
// yet, the same "UI only for now" state several other buttons in this app
// are already in.
export function GeneratedPostCard() {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: CARD_CORNER_RADIUS,
  })
  // Same pill shape as Chip (rad-md, border-subtle, surface-3) but with its
  // own icon + bold-text content rather than Chip's built-in label styling
  // — a squircle of its own since it has its own corner radius, per the
  // design-tokens rule.
  const { ref: socialRef, style: socialStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: PILL_CORNER_RADIUS })

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

  return (
    <div
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
      // paragraph, cutting its last line off mid-descender).
      className="flex h-92 w-full min-w-70 flex-col gap-dist-md rounded-rad-lg border-[length:var(--stroke-xl)] border-border-subtle bg-surface-4 p-pad-lg"
    >
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-dist-sm">
          <CalendarDots className="size-5 text-icon-subtle" weight="bold" />
          <span className="text-body-lg-bold text-text-bold">
            {PLACEHOLDER_DATE}
          </span>
        </div>
        <Button variant="danger" size="icon-sm" aria-label="Delete post">
          <Trash weight="bold" />
        </Button>
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
        <Button variant="success" size="sm" className="flex-1">
          Add to calendar
        </Button>
        <Button
          variant="brand-secondary"
          size="icon-sm"
          aria-label="Regenerate post"
        >
          <ArrowClockwise weight="bold" />
        </Button>
      </div>
    </div>
  )
}
