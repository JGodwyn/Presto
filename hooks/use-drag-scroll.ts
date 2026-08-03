"use client"

import * as React from "react"

// Below this many pixels of horizontal pointer movement, a pointer-down is
// still treated as a plain click, so tapping a button inside the row (a day
// cell in a skip-dates calendar, "Change date" on a post card) isn't
// swallowed by the drag.
const DRAG_THRESHOLD_PX = 4

// Rubber-band drag: how far past either end the content can be pulled, and
// how much of the raw pointer delta actually gets through once past an edge
// (< 1 so it visibly resists rather than tracking 1:1) — real things slow
// before they stop, per the animation standards' "damping at boundaries".
const ELASTIC_MAX_PX = 72
const ELASTIC_RESISTANCE = 0.35

// Click-and-drag horizontal scrolling for an `overflow-x-auto` row, alongside
// the wheel/trackpad scrolling that already comes for free. Two things beyond
// "set scrollLeft":
//
// - A drag threshold, so a click that happens to move a pixel or two still
//   reaches whatever button is underneath it. Pointer capture is taken only
//   once the drag actually commits, which is also what stops the release
//   from landing as a click on a card.
// - Elastic overshoot at either end: past the natural scroll bounds the
//   content still visually follows the pointer (resisted, capped at
//   ELASTIC_MAX_PX) via `elasticOffset`, which the caller applies as a
//   transform on an inner wrapper — the real scrollLeft stays clamped to its
//   true range throughout — springing back the instant the pointer releases.
//
// Shared by the Generate page's skip-dates carousel and the Content page's
// day deck. Deliberately holds no element ref: the handlers are attached to
// the scrolling element itself, so `event.currentTarget` is that element.
// (A ref threaded in or out of this hook reads to the React Compiler as a ref
// being accessed during the caller's render.)
export function useDragScroll() {
  const dragRef = React.useRef<{
    startX: number
    startScrollLeft: number
    dragging: boolean
  } | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [elasticOffset, setElasticOffset] = React.useState(0)

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    dragRef.current = {
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      dragging: false,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const el = event.currentTarget
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.startX
    if (!drag.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
      drag.dragging = true
      setIsDragging(true)
      el.setPointerCapture(event.pointerId)
    }
    const target = drag.startScrollLeft - dx
    const maxScroll = el.scrollWidth - el.clientWidth
    if (target < 0) {
      el.scrollLeft = 0
      setElasticOffset(Math.min(-target * ELASTIC_RESISTANCE, ELASTIC_MAX_PX))
    } else if (target > maxScroll) {
      el.scrollLeft = maxScroll
      setElasticOffset(
        -Math.min((target - maxScroll) * ELASTIC_RESISTANCE, ELASTIC_MAX_PX)
      )
    } else {
      el.scrollLeft = target
      setElasticOffset(0)
    }
  }

  const endDrag = () => {
    dragRef.current = null
    setIsDragging(false)
    setElasticOffset(0)
  }

  return {
    isDragging,
    elasticOffset,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  }
}
