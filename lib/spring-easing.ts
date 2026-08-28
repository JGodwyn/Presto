"use client"

// A CSS `linear()` easing sampled from a damped spring.
//
// **Why not a real spring.** Base UI owns this popover's mount/unmount and
// drives it with CSS transitions (data-starting-style / data-ending-style), and
// a CSS transition can only take an easing function — there's no spring. But
// `linear()` sets progress point by point, so a spring's actual trajectory,
// overshoot included, can be baked into one. Same trick as globals.css's
// `--ease-over-extend`, just generated from parameters instead of hand-written.
//
// Apple-style parameters, matching what Motion exposes and what the toast was
// tuned on: `bounce` 0 = critically damped (no overshoot), higher = springier.
// Sampling cost is trivial and the result is a string, so it can be recomputed
// per render while dialling values in.
export function springLinearEasing(bounce: number, samples = 24): string {
  // No overshoot wanted: a plain strong ease-out is cheaper and reads better
  // than a 24-stop approximation of one.
  if (bounce <= 0) return "cubic-bezier(0.23, 1, 0.32, 1)"

  const zeta = Math.max(0.01, Math.min(1, 1 - bounce))
  const omega = Math.PI * 2
  const omegaD = omega * Math.sqrt(1 - zeta * zeta)

  const at = (t: number) =>
    1 -
    Math.exp(-zeta * omega * t) *
      (Math.cos(omegaD * t) + ((zeta * omega) / omegaD) * Math.sin(omegaD * t))

  const points: string[] = []
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    // Pinned to exactly 0 and 1 at the ends: floating-point drift there leaves
    // the element a hair off its resting size, which is visible on text.
    const value = i === 0 ? 0 : i === samples ? 1 : at(t)
    points.push(`${value.toFixed(4)} ${(t * 100).toFixed(1)}%`)
  }

  return `linear(${points.join(", ")})`
}
