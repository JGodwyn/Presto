"use client"

import * as React from "react"

// Half a turn per tap, accumulating rather than resetting, so repeated taps
// keep spinning the same way instead of snapping back between them.
const SPIN_DEGREES = 180
// Long enough to read as a turn rather than a flicker; the strong ease-out
// this codebase uses everywhere for something arriving.
const SPIN_DURATION_MS = 300
const SPIN_EASING = "cubic-bezier(0.23, 1, 0.32, 1)"

// Turns an icon on each tap of the control it sits in — the Content page's
// "Show as" pill and the filter menu's Social row, both of which cycle through
// values rather than opening a list. The icon is the *act* of switching, not a
// readout of the state, which is why the angle accumulates and why it starts
// unrotated when a saved value is restored.
//
// Animated imperatively rather than transitioned from the inline `rotate`. A
// CSS transition only fires if the browser observed the old value in a
// rendered frame first, and the tap that changes this also swaps out the
// content underneath it — a commit big enough that the change was sometimes
// applied without a transition ever starting, so the icon jumped (confirmed
// in-browser on the "Show as" pill: same node, `transition-property: rotate`,
// 0.3s duration, and no `transitionrun` event at all). An animation states its
// own from/to, so it can't depend on what the previous frame happened to
// compute. The returned `style` still holds the resting value, which is what
// the animation lands on when it finishes.
//
// Destructure at the call site (`const { ref: iconRef } = useIconSpin()`) —
// reading `spin.ref` straight into JSX trips react-hooks/refs.
export function useIconSpin() {
  const [angle, setAngle] = React.useState(0)
  const ref = React.useRef<SVGSVGElement>(null)

  const spin = React.useCallback(() => {
    const to = angle + SPIN_DEGREES
    ref.current?.animate([{ rotate: `${angle}deg` }, { rotate: `${to}deg` }], {
      duration: SPIN_DURATION_MS,
      easing: SPIN_EASING,
    })
    setAngle(to)
  }, [angle])

  return { ref, style: { rotate: `${angle}deg` }, spin }
}
