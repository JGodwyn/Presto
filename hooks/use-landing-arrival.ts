"use client"

import * as React from "react"

// When a landing section's entrance should play. It's the same rule as the
// problem sequence: start once the section fills at least half the screen
// (or half of itself, if it's shorter than the screen), which is where the
// page's scroll snap will settle, rather than when a sliver of it scrolls in.
// That way the entrance plays while the section is in view instead of having
// mostly finished on the way. It resets once the section is fully off screen,
// and each arrival bumps `playKey`. Key the animated elements on it so they
// remount and replay from the start. With `once`, it never resets: the
// entrance plays on the first arrival only.
//
// Reads the landing page's own scroll container ([data-landing-scroll]),
// which is what scrolls; the document never does.
function useLandingArrival<T extends HTMLElement>({ once = false }: { once?: boolean } = {}) {
  const ref = React.useRef<T>(null)
  const [state, setState] = React.useState({ isInView: false, playKey: 0 })

  React.useEffect(() => {
    const section = ref.current
    const scrollContainer = section?.closest<HTMLElement>("[data-landing-scroll]")
    if (!section || !scrollContainer) return

    const update = () => {
      const top = scrollContainer.scrollTop
      const height = scrollContainer.clientHeight
      const visible =
        Math.min(top + height, section.offsetTop + section.offsetHeight) -
        Math.max(top, section.offsetTop)
      if (visible >= Math.min(height, section.offsetHeight) / 2) {
        setState((current) =>
          current.isInView ? current : { isInView: true, playKey: current.playKey + 1 }
        )
      } else if (!once && visible <= 0) {
        setState((current) => (current.isInView ? { ...current, isInView: false } : current))
      }
    }

    update()
    scrollContainer.addEventListener("scroll", update, { passive: true })
    scrollContainer.addEventListener("scrollend", update)
    window.addEventListener("resize", update)
    return () => {
      scrollContainer.removeEventListener("scroll", update)
      scrollContainer.removeEventListener("scrollend", update)
      window.removeEventListener("resize", update)
    }
  }, [once])

  return { ref, ...state }
}

export { useLandingArrival }
