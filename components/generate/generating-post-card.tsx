"use client"

import * as React from "react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

const CARD_CORNER_RADIUS = 16 // rad-lg
const DASH = 2
const GAP = 12
// One full dash+gap repeat — offsetting stroke-dashoffset by exactly this
// much loops with no visible seam (the pattern lines back up with itself).
const DASH_CYCLE = DASH + GAP

interface GeneratingPostCardProps {
  // Live-tunable via the DialKit panel (see GeneratingView) — the
  // "Generating…" text's own opacity pulse.
  textOpacityMin: number
  textOpacityDuration: number
  // Live-tunable — turns the marching dashes on/off entirely.
  rotationEnabled: boolean
  // Live-tunable — seconds per full lap of the marching dashes.
  rotationDuration: number
  // Live-tunable — how low the border's opacity dips at the bottom of its
  // own pulse.
  borderOpacityMin: number
  borderOpacityDuration: number
}

// Placeholder shown for the one post currently generating, from the Figma
// "Generate / Generating template" export. GeneratingView only ever mounts
// this while that post is actually in flight (not stopped, not already
// finished) — there's no pause state to model here: Stop unmounts it
// entirely rather than freezing it in place, so mount/unmount alone starts
// and stops every animation below.
export function GeneratingPostCard({
  textOpacityMin,
  textOpacityDuration,
  rotationEnabled,
  rotationDuration,
  borderOpacityMin,
  borderOpacityDuration,
}: GeneratingPostCardProps) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: CARD_CORNER_RADIUS,
  })
  // CSS border-dashed can't do a custom dash/gap length or a round cap —
  // drawn as an SVG stroke instead, same trick as ScheduledPostsBar: reuse
  // the squircle clip-path's own path string as the border's `d` so the
  // fill and the border trace the exact same curve rather than two
  // independently-derived paths that could drift apart.
  const borderPathD = style?.clipPath?.match(/path\('(.+)'\)/)?.[1]

  const textRef = React.useRef<HTMLSpanElement>(null)
  const pathRef = React.useRef<SVGPathElement>(null)

  // Text pulse — Web Animations API rather than a CSS class, since
  // opacityMin needs to be an arbitrary live number (a CSS keyframe's stop
  // values aren't overridable from outside the stylesheet).
  React.useEffect(() => {
    const el = textRef.current
    if (!el) return

    const anim = el.animate(
      [{ opacity: 1 }, { opacity: textOpacityMin }, { opacity: 1 }],
      {
        duration: textOpacityDuration * 1000,
        iterations: Infinity,
        easing: "ease-in-out",
      }
    )

    return () => anim.cancel()
  }, [textOpacityMin, textOpacityDuration])

  // Border rotation + opacity, rebuilt (cancel + restart) whenever a dial
  // value changes — same pattern as the calendar's "Error shake" dial, a
  // live slider drag should change the actual motion, not just retime
  // whatever was already playing. Rotation is entirely optional now
  // (rotationEnabled) — skipping `el.animate()` when it's off leaves
  // strokeDashoffset at its unanimated default (0), a plain static dash.
  React.useEffect(() => {
    const el = pathRef.current
    if (!el) return

    const rotation = rotationEnabled
      ? el.animate(
          [{ strokeDashoffset: 0 }, { strokeDashoffset: -DASH_CYCLE }],
          {
            duration: rotationDuration * 1000,
            iterations: Infinity,
            easing: "linear",
          }
        )
      : null

    const opacityAnim = el.animate(
      [{ opacity: 1 }, { opacity: borderOpacityMin }, { opacity: 1 }],
      {
        duration: borderOpacityDuration * 1000,
        iterations: Infinity,
        easing: "ease-in-out",
        // Half a cycle "ahead", so the border starts already at its dip
        // the instant the text (its own separate, independently-timed
        // pulse above) is at its peak — the two read as alternating at
        // first rather than moving together, though independently
        // tunable durations mean they'll drift out of sync over time.
        delay: -(borderOpacityDuration * 500),
      }
    )

    return () => {
      rotation?.cancel()
      opacityAnim.cancel()
    }
  }, [rotationEnabled, rotationDuration, borderOpacityMin, borderOpacityDuration])

  return (
    // Unclipped — the clip-path lives on the fill layer below, not here,
    // so the border svg (a sibling, not a descendant of that clip) can
    // paint its stroke's outer bleed freely instead of having it cut off
    // at the fill's own edge.
    <div className="relative h-92 w-full min-w-70">
      {/* inset-0.5 (2px = half the border's own 4px strokeWidth): the fill
          and border below are measured/drawn against this slightly smaller
          box, not the full h-92/w-full one, so the border's centered stroke
          — which bleeds 2px outside whatever path it's drawn on — lands its
          outer edge exactly on the true h-92/w-full boundary instead of 2px
          past it. Without this inset, this card's actual visual footprint
          was 4px taller/wider than GeneratedPostCard's (whose border is a
          plain CSS border, contained within its box by definition), even
          though both divs declare the same h-92/w-full size. */}
      <div className="absolute inset-0.5">
        <div
          ref={ref}
          style={style}
          className="absolute inset-0 flex flex-col gap-dist-md rounded-rad-lg bg-surface-3 p-pad-lg"
        >
          <span ref={textRef} className="text-body-lg-bold text-text-subtle">
            Generating…
          </span>
        </div>

        {/* Always mounted, even before borderPathD resolves (empty `d` draws
            nothing) — rather than conditionally rendering the whole <path>,
            which would start its WAAPI animations from whatever moment the
            clip-path measurement happens to finish, not from the same paint
            as the text's own. */}
        <svg
          aria-hidden
          // overflow-visible: SVG clips at its own viewport edge by default
          // — on top of no longer sharing the fill's clip-path (see above),
          // the svg's own viewport would otherwise still clip the centered
          // stroke's outer half at its exact border-box edge.
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          <path
            ref={pathRef}
            d={borderPathD ?? ""}
            fill="none"
            strokeWidth={4}
            strokeDasharray={`${DASH} ${GAP}`}
            strokeLinecap="round"
            className="stroke-border-bold"
          />
        </svg>
      </div>
    </div>
  )
}
