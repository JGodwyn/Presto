"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"

// This is the same compact elastic character treatment as the generating-post
// heading (GeneratingView's HEADING_ANIMATION), used once here because a
// public landing page is a rare, explanatory arrival rather than a repeated
// in-app action. Keeping the values aligned lets the product introduce itself
// in the same voice as its generation state.
const HEADING_ENTRANCE = {
  offset: 5,
  stagger: 0.03,
  blur: 3,
  duration: 0.25,
  bounce: 0.4,
}

const SUBHEADING_ENTRANCE = {
  offset: 7,
  stagger: 0.012,
  blur: 3,
  duration: 0.4,
  bounce: 0.4,
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const

function AnimatedCharacters({
  lines,
  label,
  delay = 0,
  entrance = HEADING_ENTRANCE,
}: {
  lines: string[]
  label: string
  delay?: number
  entrance?: typeof HEADING_ENTRANCE
}) {
  const prefersReducedMotion = useReducedMotion()
  let characterIndex = 0

  return (
    <>
      <span aria-hidden className="flex flex-col items-center">
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="flex justify-center whitespace-nowrap">
          {line.split(/(\s+)/).map((token, tokenIndex) => {
            if (/^\s+$/.test(token)) {
              return <span key={tokenIndex}>&nbsp;</span>
            }

            return (
              <span key={tokenIndex} className="inline-flex">
                {Array.from(token).map((character) => {
                  const characterDelay = delay + characterIndex * entrance.stagger
                  characterIndex += 1

                  return (
                    <motion.span
                      key={`${lineIndex}-${tokenIndex}-${characterIndex}`}
                      className="inline-block"
                      initial={{
                        opacity: 0,
                        filter: prefersReducedMotion ? "blur(0px)" : `blur(${entrance.blur}px)`,
                        transform: prefersReducedMotion
                          ? "translateY(0)"
                          : `translateY(${entrance.offset}px)`,
                      }}
                      animate={{ opacity: 1, filter: "blur(0px)", transform: "translateY(0)" }}
                      transition={
                        prefersReducedMotion
                          ? {
                              duration: 0.2,
                              ease: EASE_OUT,
                              delay: characterDelay,
                            }
                          : {
                              type: "spring",
                              duration: entrance.duration,
                              bounce: entrance.bounce,
                              delay: characterDelay,
                            }
                      }
                    >
                      {character}
                    </motion.span>
                  )
                })}
              </span>
            )
          })}
        </span>
      ))}
      </span>
      <span className="sr-only">{label}</span>
    </>
  )
}

function AnimatedHeroCopy() {
  const prefersReducedMotion = useReducedMotion()
  const buttonDelay = prefersReducedMotion ? 0 : 1.5

  return (
    <div className="flex w-full max-w-[560px] flex-col items-center">
      <h1 className="text-hero-lg font-display font-semibold text-text-bold">
        <AnimatedCharacters
          label="Your posts. Your voice. in one sitting."
          lines={["Your posts.", "Your voice.", "in one sitting."]}
        />
      </h1>

      <p className="mt-[var(--dist-2xl)] max-w-[416px] text-body-xl text-text-subtle">
        <span className="md:hidden">
          <AnimatedCharacters
            label="Presto learns how you write, generates a batch on any topic, and drops them into a calendar you control."
            lines={[
              "Presto learns how you write,",
              "generates a batch on any topic,",
              "and drops them into a calendar you control.",
            ]}
            delay={0.51}
            entrance={SUBHEADING_ENTRANCE}
          />
        </span>
        <span className="hidden md:block">
          <AnimatedCharacters
            label="Presto learns how you write, generates a batch on any topic, and drops them into a calendar you control."
            lines={[
              "Presto learns how you write, generates a",
              "batch on any topic, and drops them into a",
              "calendar you control.",
            ]}
            delay={0.51}
            entrance={SUBHEADING_ENTRANCE}
          />
        </span>
      </p>

      <motion.div
        className="mt-[var(--dist-2xl)]"
        initial={{
          opacity: 0,
          filter: prefersReducedMotion ? "blur(0px)" : "blur(6.5px)",
          transform: prefersReducedMotion ? "translateY(0) scale(1)" : "translateY(10px) scale(0.9)",
        }}
        animate={{ opacity: 1, filter: "blur(0px)", transform: "translateY(0) scale(1)" }}
        transition={{ duration: 0.45, ease: EASE_OUT, delay: buttonDelay }}
      >
        <span className="inline-flex drop-shadow-[0_var(--dist-md)_var(--dist-lg)_color-mix(in_srgb,var(--button-brand-primary-rest)_40%,transparent)]">
          <Button
            variant="brand"
            size="xl"
            nativeButton={false}
            className="w-68"
            render={<Link href="/signup" />}
          >
            Start generating now
          </Button>
        </span>
      </motion.div>
    </div>
  )
}

export { AnimatedHeroCopy }
