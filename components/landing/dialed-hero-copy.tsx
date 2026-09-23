"use client"

import * as React from "react"
import Link from "next/link"
import { useDialKit, type TransitionConfig } from "dialkit"
import { motion, useReducedMotion, type Transition } from "motion/react"

import { Button } from "@/components/ui/button"

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

type TextEntrance = {
  enabled: boolean
  delay: number
  offset: number
  stagger: number
  opacityFrom: number
  blurFrom: number
  transition: Transition
}

// DialKit labels its Bézier editor "easing" while Motion calls the matching
// transition a tween. The panel can switch modes live, so adapt both shapes
// at this boundary instead of narrowing the panel to springs only.
function toMotionTransition(transition: TransitionConfig): Transition {
  if (transition.type === "easing") {
    return { duration: transition.duration, ease: transition.ease }
  }

  return {
    type: "spring",
    stiffness: transition.stiffness,
    damping: transition.damping,
    mass: transition.mass,
    visualDuration: transition.visualDuration,
    bounce: transition.bounce,
  }
}

function AnimatedCharacters({
  lines,
  label,
  entrance,
}: {
  lines: string[]
  label: string
  entrance: TextEntrance
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
                    const characterDelay = entrance.delay + characterIndex * entrance.stagger
                    characterIndex += 1

                    return (
                      <motion.span
                        key={`${lineIndex}-${tokenIndex}-${characterIndex}`}
                        className="inline-block"
                        initial={
                          entrance.enabled
                            ? {
                                opacity: entrance.opacityFrom,
                                filter: prefersReducedMotion
                                  ? "blur(0px)"
                                  : `blur(${entrance.blurFrom}px)`,
                                transform: prefersReducedMotion
                                  ? "translateY(0)"
                                  : `translateY(${entrance.offset}px)`,
                              }
                            : false
                        }
                        animate={{ opacity: 1, filter: "blur(0px)", transform: "translateY(0)" }}
                        transition={{ ...entrance.transition, delay: characterDelay }}
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

function DialedHeroCopy() {
  const [replayKey, setReplayKey] = React.useState(0)
  const prefersReducedMotion = useReducedMotion()
  const settings = useDialKit(
    "Landing hero motion",
    {
      heading: {
        enabled: true,
        delay: [0, 0, 2, 0.01],
        offset: [5, 0, 64, 1],
        stagger: [0.03, 0, 0.12, 0.001],
        opacityFrom: [0, 0, 1, 0.01],
        blurFrom: [3, 0, 16, 0.25],
        transition: { type: "spring", visualDuration: 0.25, bounce: 0.4 },
      },
      subheading: {
        enabled: true,
        delay: [0.51, 0, 2, 0.01],
        offset: [7, 0, 64, 1],
        stagger: [0.012, 0, 0.12, 0.001],
        opacityFrom: [0, 0, 1, 0.01],
        blurFrom: [3, 0, 16, 0.25],
        transition: { type: "spring", visualDuration: 0.4, bounce: 0.4 },
      },
      button: {
        enabled: true,
        delay: [1.5, 0, 3, 0.01],
        offset: [10, -48, 48, 1],
        scaleFrom: [1, 0.9, 1.1, 0.01],
        opacityFrom: [0, 0, 1, 0.01],
        blurFrom: [6.5, 0, 32, 0.25],
        transition: { type: "easing", duration: 0.45, ease: EASE_OUT },
      },
      replay: { type: "action", label: "Replay animation" },
    },
    {
      id: "landing-hero-motion",
      persist: true,
      onAction: (action) => {
        if (action === "replay") setReplayKey((key) => key + 1)
      },
    }
  )

  const headingEntrance: TextEntrance = {
    ...settings.heading,
    transition: toMotionTransition(settings.heading.transition),
  }
  const subheadingEntrance: TextEntrance = {
    ...settings.subheading,
    transition: toMotionTransition(settings.subheading.transition),
  }
  // Entrance properties are read by Motion at mount. Giving the preview a
  // value-derived key makes every DialKit adjustment immediately replay the
  // affected composition, instead of asking the user to refresh or infer
  // whether a changed initial state took effect.
  const previewKey = `${replayKey}-${JSON.stringify({
    heading: settings.heading,
    subheading: settings.subheading,
    button: settings.button,
  })}`

  return (
    <div className="flex w-full max-w-[560px] flex-col items-center">
      <h1 className="text-hero-lg font-display font-semibold text-text-bold">
        <AnimatedCharacters
          key={`heading-${previewKey}`}
          label="Your posts. Your voice. in one sitting."
          lines={["Your posts.", "Your voice.", "in one sitting."]}
          entrance={headingEntrance}
        />
      </h1>

      <p className="mt-[var(--dist-2xl)] max-w-[416px] text-body-xl text-text-subtle">
        <span className="md:hidden">
          <AnimatedCharacters
            key={`subheading-mobile-${previewKey}`}
            label="Presto learns how you write, generates a batch on any topic, and drops them into a calendar you control."
            lines={[
              "Presto learns how you write,",
              "generates a batch on any topic,",
              "and drops them into a calendar you control.",
            ]}
            entrance={subheadingEntrance}
          />
        </span>
        <span className="hidden md:block">
          <AnimatedCharacters
            key={`subheading-desktop-${previewKey}`}
            label="Presto learns how you write, generates a batch on any topic, and drops them into a calendar you control."
            lines={[
              "Presto learns how you write, generates a",
              "batch on any topic, and drops them into a",
              "calendar you control.",
            ]}
            entrance={subheadingEntrance}
          />
        </span>
      </p>

      <motion.div
        key={`button-${previewKey}`}
        className="mt-[var(--dist-2xl)]"
        initial={
          settings.button.enabled
            ? {
                opacity: settings.button.opacityFrom,
                filter: prefersReducedMotion ? "blur(0px)" : `blur(${settings.button.blurFrom}px)`,
                transform: prefersReducedMotion
                  ? "translateY(0) scale(1)"
                  : `translateY(${settings.button.offset}px) scale(${settings.button.scaleFrom})`,
              }
            : false
        }
        animate={{ opacity: 1, filter: "blur(0px)", transform: "translateY(0) scale(1)" }}
        transition={{
          ...toMotionTransition(settings.button.transition),
          delay: settings.button.delay,
        }}
      >
        <Button variant="brand" size="xl" className="w-68" render={<Link href="/signup" />}>
          Start generating now
        </Button>
      </motion.div>
    </div>
  )
}

export { DialedHeroCopy }
