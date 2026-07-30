"use client"

import * as React from "react"

// Alternating, decaying translateX hops — amplitude is the first hop's
// distance in px, decay (0-1) is how much each subsequent hop shrinks by,
// hops is how many left/right swings happen before settling back to 0.
// Built from the constants below rather than being a fixed keyframe array,
// so the shape stays readable as three numbers instead of a wall of
// transforms. Total duration is spread evenly across
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

// Tuned live on a DialKit panel and frozen here once the feel was right; the
// panel is gone (git history has it if the shake ever needs re-tuning). The
// curve was compared against the app's own strong ease-in-out and against
// linear/ease-in-out — ease-out front-loads the motion, which is what makes
// the first hop read as a flick rather than a wobble.
const SHAKE_DURATION_MS = 480
const SHAKE_AMPLITUDE_PX = 10
const SHAKE_DECAY = 0.7
const SHAKE_HOPS = 5
const SHAKE_EASING = "ease-out"

// Shared by every inline error message in the Generate flow that shakes on
// appearance (originally built for the calendar-based date-selection error,
// components/generate/generate-calendar-column.tsx — extracted here once a
// second call site needed the identical effect, generating-view.tsx's
// generation-failure message). Attach the returned ref to the element that
// should shake; it replays whenever `trigger` flips from false to true.
export function useShake<T extends HTMLElement>(trigger: boolean) {
  const ref = React.useRef<T>(null)

  // WAAPI rather than a CSS keyframes/transition so a rapid re-trigger (error
  // clears, then reappears right after) restarts cleanly instead of queuing.
  // Skipped under prefers-reduced-motion per STANDARDS.md (drop
  // transform-based motion, keep the message itself appearing).
  React.useEffect(() => {
    if (!trigger) return
    const element = ref.current
    if (!element) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    element.animate(
      buildShakeKeyframes(SHAKE_AMPLITUDE_PX, SHAKE_DECAY, SHAKE_HOPS),
      { duration: SHAKE_DURATION_MS, easing: SHAKE_EASING }
    )
  }, [trigger])

  return ref
}
