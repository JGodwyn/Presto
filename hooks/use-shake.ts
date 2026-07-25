"use client"

import * as React from "react"
import { useDialKit } from "dialkit"

// Alternating, decaying translateX hops — amplitude is the first hop's
// distance in px, decay (0-1) is how much each subsequent hop shrinks by,
// hops is how many left/right swings happen before settling back to 0.
// Regenerated on every trigger from the live DialKit values below rather
// than a fixed keyframe array, so dragging a slider changes the actual
// motion, not just its timing. Total duration is spread evenly across
// hops+1 segments (WAAPI's default when keyframes carry no offsets), so
// raising the hop count for the same duration shortens each individual
// swing — that's the lever that actually changes "quick flick" vs.
// "slow, deliberate wobble," independent of the total duration.
function buildShakeKeyframes(amplitude: number, decay: number, hops: number): Keyframe[] {
  const keyframes: Keyframe[] = [{ transform: "translateX(0)" }]
  for (let i = 0; i < hops; i++) {
    const sign = i % 2 === 0 ? -1 : 1
    const px = amplitude * decay ** i
    keyframes.push({ transform: `translateX(${sign * px}px)` })
  }
  keyframes.push({ transform: "translateX(0)" })
  return keyframes
}

// Named curves worth comparing against the app's own strong ease-in-out —
// a shake reads very differently under each: linear feels mechanical/even,
// ease-in-out (generic) is much gentler than the app's own strong variant,
// ease-out front-loads the motion.
const SHAKE_EASING_OPTIONS: Record<string, string> = {
  "strong-ease-in-out": "cubic-bezier(0.77,0,0.175,1)",
  "ease-in-out": "ease-in-out",
  "ease-out": "ease-out",
  linear: "linear",
}

// Shared by every inline error message in the Generate flow that shakes on
// appearance (originally built for the calendar-based date-selection error,
// components/generate/generate-calendar-column.tsx — extracted here once a
// second call site needed the identical effect, generating-view.tsx's
// generation-failure message). Attach the returned ref to the element that
// should shake; it replays whenever `trigger` flips from false to true, or
// (while already true) whenever a DialKit value changes — same "double duty"
// dependency array as the original, for live-tweaking without a replay
// button.
export function useShake<T extends HTMLElement>(trigger: boolean) {
  const ref = React.useRef<T>(null)

  // Live-tunable via the DialKit panel (top-right, dev only) instead of
  // hand-editing values and reloading.
  const shakeDial = useDialKit("Error shake", {
    duration: [480, 100, 800, 10],
    amplitude: [10, 0, 20],
    decay: [0.7, 0.3, 1, 0.05],
    hops: [5, 2, 12, 1],
    easing: {
      type: "select",
      options: [
        { value: "strong-ease-in-out", label: "Strong ease-in-out (app default)" },
        { value: "ease-in-out", label: "Ease-in-out" },
        { value: "ease-out", label: "Ease-out" },
        { value: "linear", label: "Linear" },
      ],
      default: "ease-out",
    },
  })

  // WAAPI rather than a CSS keyframes/transition so a rapid re-trigger
  // (error clears, then reappears right after, or a slider drag mid-shake)
  // restarts cleanly instead of queuing. Skipped under
  // prefers-reduced-motion per STANDARDS.md (drop transform-based motion,
  // keep the message itself appearing).
  React.useEffect(() => {
    if (!trigger) return
    const element = ref.current
    if (!element) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    element.animate(
      buildShakeKeyframes(shakeDial.amplitude, shakeDial.decay, shakeDial.hops),
      {
        duration: shakeDial.duration,
        easing: SHAKE_EASING_OPTIONS[shakeDial.easing],
      }
    )
  }, [
    trigger,
    shakeDial.duration,
    shakeDial.amplitude,
    shakeDial.decay,
    shakeDial.hops,
    shakeDial.easing,
  ])

  return ref
}
