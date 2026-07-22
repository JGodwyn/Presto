"use client"

import NumberFlow from "@number-flow/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma --rad-lg as px for the squircle path math.
const BAR_CORNER_RADIUS = 16

// The counter bar from the Figma "Generate (Calendar based)" exports —
// reflects however many posts the current date selection implies. Reuses
// NumberFlow (already brought in for the number-based stepper) so the count
// eases between values as dates are added/removed rather than snapping.
// Per direct feedback: no more fill — outlined only, with a dashed border
// (dash 4, gap 4) instead of the earlier solid dark surface.
function ScheduledPostsBar({ count }: { count: number }) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: BAR_CORNER_RADIUS,
  })
  // useSquircleClipPath's clip-path is a bare `path('<d>')` string — reused
  // directly for the dashed border below so the two shapes stay
  // byte-identical instead of re-deriving the squircle path a second time.
  const borderPathD = style?.clipPath?.match(/path\('(.+)'\)/)?.[1]

  return (
    <div
      ref={ref}
      style={style}
      // h-10 (40px): the box's height before the count switched to
      // heading-sm — that class's taller line-height would otherwise grow
      // the box along with it, so the height is now pinned explicitly and
      // items-center absorbs the extra line-height evenly into the padding
      // instead of pushing the box taller.
      className="relative flex h-10 w-full items-center justify-between rounded-rad-lg px-pad-md py-pad-sm"
    >
      {borderPathD ? (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
        >
          {/* strokeWidth 2 is --stroke-lg as a literal px number — same
              convention as the corner-radius constant above, since SVG
              geometry attributes need a real number, not a CSS var. */}
          <path
            d={borderPathD}
            fill="none"
            strokeWidth={2}
            strokeDasharray="4 4"
            className="stroke-border-bold"
          />
        </svg>
      ) : null}
      <span className="text-body-lg text-text-bold">Number of posts</span>
      <NumberFlow value={count} className="text-heading-sm font-display text-text-bold" />
    </div>
  )
}

export { ScheduledPostsBar }
