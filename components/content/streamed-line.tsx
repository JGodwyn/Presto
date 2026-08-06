"use client"

import * as React from "react"
import { motion } from "motion/react"

// The regenerate body-reveal's per-chunk entrance: the same general "wavy"
// spring-stagger AnimateText uses for the Generating heading (offset + spring
// bounce, now with blur too — a "blurReplace" feel), but per WORD rather than
// per character. AnimateText's elastic type lays its letters out as a single
// unbreakable flex row (fine for a short heading, never a full sentence), so
// reusing it here would stop a long line from ever wrapping — this is a
// separate, small component rather than extending that shared one, purpose-
// built so each word is its own normal inline element and the browser wraps
// between words exactly like plain text.
export function StreamedLine({
  text,
  offset,
  stagger,
  duration,
  bounce,
  blur,
}: {
  text: string
  offset: number
  stagger: number
  duration: number
  bounce: number
  blur: number
}) {
  // Keeps whitespace (including a closing \n) as its own tokens rather than
  // trimming it away, so the original spacing survives byte-for-byte and a
  // real newline still renders as a line break — whitespace-pre-wrap on the
  // ancestor honors \n regardless of which node it's inside.
  const tokens = text.split(/(\s+)/).filter((token) => token.length > 0)
  // Word index per token (-1 for whitespace tokens), built as its own pure
  // pass rather than an outer counter mutated inside the render map below —
  // reassigning a variable captured by that callback across iterations is
  // exactly what react-hooks/immutability flags.
  const wordIndices = tokens.reduce<number[]>((indices, token) => {
    const previous = indices.length > 0 ? indices[indices.length - 1] : -1
    indices.push(/^\s+$/.test(token) ? previous : previous + 1)
    return indices
  }, [])

  return (
    <>
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) {
          return <React.Fragment key={i}>{token}</React.Fragment>
        }
        const delay = wordIndices[i] * stagger
        return (
          <motion.span
            key={i}
            className="inline-block"
            initial={{ y: offset, opacity: 0, filter: `blur(${blur}px)` }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            transition={{
              type: "spring",
              duration,
              bounce,
              delay,
              // Off the spring, same reasoning as toast.tsx's own entrance:
              // a spring's bounce can overshoot past target, which reads as
              // a flicker on opacity and isn't meaningful on blur (negative
              // blur isn't a real value) — both get a plain shorter ease-out
              // instead, still starting at the same staggered delay.
              opacity: { duration: duration * 0.8, ease: "easeOut", delay },
              filter: { duration: duration * 0.8, ease: "easeOut", delay },
            }}
          >
            {token}
          </motion.span>
        )
      })}
    </>
  )
}
