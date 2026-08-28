import { describe, expect, it } from "vitest"

import { springLinearEasing } from "@/lib/spring-easing"

// Parses "linear(0 0%, 0.03 4.2%, …)" back into its progress values, so the
// curve's *shape* can be asserted rather than its exact string.
function progressValues(easing: string) {
  const inner = easing.slice(easing.indexOf("(") + 1, easing.lastIndexOf(")"))
  return inner.split(",").map((stop) => Number(stop.trim().split(" ")[0]))
}

describe("springLinearEasing", () => {
  it("falls back to a plain cubic-bezier when there is no bounce", () => {
    // 24 stops approximating a curve a single bezier already describes would
    // be pure cost, so bounce 0 short-circuits.
    expect(springLinearEasing(0)).toBe("cubic-bezier(0.23, 1, 0.32, 1)")
    expect(springLinearEasing(-1)).toBe("cubic-bezier(0.23, 1, 0.32, 1)")
  })

  it("emits a linear() curve once there is bounce", () => {
    const easing = springLinearEasing(0.25)
    expect(easing.startsWith("linear(")).toBe(true)
    expect(easing.endsWith(")")).toBe(true)
  })

  it("starts at 0 and ends at exactly 1", () => {
    const values = progressValues(springLinearEasing(0.25))

    // Pinned rather than merely close: floating-point drift at the ends would
    // leave the element a hair off its resting size, which is visible on text.
    expect(values[0]).toBe(0)
    expect(values[values.length - 1]).toBe(1)
  })

  it("overshoots past 1 — that overshoot is the whole point", () => {
    const values = progressValues(springLinearEasing(0.5))
    expect(Math.max(...values)).toBeGreaterThan(1)
  })

  it("overshoots further as bounce rises", () => {
    const gentle = Math.max(...progressValues(springLinearEasing(0.2)))
    const springy = Math.max(...progressValues(springLinearEasing(0.6)))
    expect(springy).toBeGreaterThan(gentle)
  })

  it("honours the sample count", () => {
    // samples + 1 stops: the range is inclusive of both ends.
    expect(progressValues(springLinearEasing(0.25, 8))).toHaveLength(9)
    expect(progressValues(springLinearEasing(0.25, 40))).toHaveLength(41)
  })

  it("clamps bounce at 1 rather than dividing by zero", () => {
    // zeta = 1 - bounce, and zeta 0 would make the damped frequency 0 — every
    // sample NaN, and a curve the browser silently rejects.
    const values = progressValues(springLinearEasing(1))
    expect(values.every((value) => Number.isFinite(value))).toBe(true)
  })
})
