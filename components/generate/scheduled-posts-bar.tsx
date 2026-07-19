"use client"

import NumberFlow from "@number-flow/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma --rad-lg as px for the squircle path math.
const BAR_CORNER_RADIUS = 16

// The dark counter bar from the Figma "Generate (Calendar based)" exports —
// reflects however many posts the current date selection implies. Reuses
// NumberFlow (already brought in for the number-based stepper) so the count
// eases between values as dates are added/removed rather than snapping.
function ScheduledPostsBar({ count }: { count: number }) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: BAR_CORNER_RADIUS,
  })

  return (
    <div
      ref={ref}
      style={style}
      className="flex w-full items-center justify-between rounded-rad-lg bg-surface-inverse px-pad-md py-pad-sm"
    >
      <span className="text-body-lg text-text-inverse">Scheduled Posts</span>
      <NumberFlow
        value={count}
        className="text-body-lg-bold text-text-inverse"
      />
    </div>
  )
}

export { ScheduledPostsBar }
