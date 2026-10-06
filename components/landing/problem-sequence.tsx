"use client"

import * as React from "react"
import { motion, useReducedMotion, type Transition } from "motion/react"

import { MarkerStroke } from "@/components/landing/marker-stroke"
import { cn } from "@/lib/utils"

type Problem = {
  eyebrow: string
  lines: CopySegment[][]
  mobileLines: CopySegment[][]
}

type CopySegment = {
  text: string
  emphasis?: boolean
  nowrap?: boolean
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

type ProblemMotionSettings = {
  eyebrow: {
    enabled: boolean
    delay: number
    offset: number
    opacityFrom: number
    blurFrom: number
    transition: Transition
  }
  body: {
    enabled: boolean
    delay: number
    offset: number
    stagger: number
    lineBreakDelay: number
    opacityFrom: number
    blurFrom: number
    transition: Transition
  }
  highlight: {
    enabled: boolean
    contourRoughness: number
    delay: number
    opacityFrom: number
    blurFrom: number
    transition: Transition
  }
}

const PROBLEM_MOTION_SETTINGS = {
  eyebrow: {
    enabled: true,
    delay: 0,
    offset: 16,
    opacityFrom: 0.59,
    blurFrom: 8,
    transition: { duration: 1, ease: EASE_OUT },
  },
  body: {
    enabled: true,
    delay: 0.25,
    offset: 5,
    stagger: 0.008,
    lineBreakDelay: 0.1,
    opacityFrom: 0,
    blurFrom: 2,
    transition: { type: "spring", stiffness: 950, damping: 46, mass: 9 },
  },
  highlight: {
    enabled: true,
    contourRoughness: 0,
    delay: 0,
    opacityFrom: 1,
    blurFrom: 0,
    transition: { duration: 0.65, ease: EASE_OUT },
  },
} satisfies ProblemMotionSettings

const problems: Problem[] = [
  {
    eyebrow: "Every post starts from zero",
    lines: [
      [{ text: "You know what you want to say." }],
      [{ text: "Getting it into words takes" }],
      [{ text: "40 minutes", emphasis: true }, { text: " you don't have." }],
    ],
    mobileLines: [
      [{ text: "You know what you want to say." }],
      [{ text: "Getting it into words" }],
      [{ text: "takes " }, { text: "40 minutes", emphasis: true }, { text: " you don't have." }],
    ],
  },
  {
    eyebrow: "Ideas live in six places",
    lines: [
      [{ text: "Notes app, drafts folder, a voice" }],
      [{ text: "memo, a screenshot. " }, { text: "None", emphasis: true }, { text: " of" }],
      [{ text: "them are a plan." }],
    ],
    mobileLines: [
      [{ text: "Notes app, drafts folder, a" }],
      [{ text: "voice memo, a screenshot." }],
      [{ text: "None", emphasis: true }, { text: " of them are a plan." }],
    ],
  },
  {
    eyebrow: "Week three is where it dies",
    lines: [
      [{ text: "You post well for " }, { text: "two weeks", emphasis: true }, { text: ", get" }],
      [{ text: "busy with client work, and go" }],
      [{ text: "quiet for a month." }],
    ],
    mobileLines: [
      [{ text: "You post well for " }, { text: "two weeks", emphasis: true }, { text: "," }],
      [{ text: "get busy with " }, { text: "client work,", nowrap: true }],
      [{ text: "and go quiet" }],
      [{ text: "for a month." }],
    ],
  },
]

function Emphasis({
  children,
  delay,
  settings,
  animateEntrance,
}: {
  children: React.ReactNode
  delay: number
  settings: ProblemMotionSettings["highlight"]
  animateEntrance: boolean
}) {
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimate = animateEntrance && settings.enabled
  const revealInitial = {
    clipPath: prefersReducedMotion ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
    opacity: prefersReducedMotion ? 0 : settings.opacityFrom,
    filter:
      shouldAnimate && !prefersReducedMotion
        ? `blur(${settings.blurFrom}px)`
        : "blur(0px)",
  }
  const revealFinal = {
    clipPath: "inset(0 0% 0 0)",
    opacity: 1,
    filter: "blur(0px)",
  }
  const baseFinal = prefersReducedMotion
    ? { clipPath: "inset(0 0% 0 0)", opacity: 0 }
    : { clipPath: "inset(0 0 0 100%)", opacity: 1 }
  const transition = prefersReducedMotion
    ? { duration: 0.2, ease: EASE_OUT, delay }
    : { ...settings.transition, delay }

  return (
    <span className="relative isolate inline-block">
      <motion.span
        data-problem-highlight-background
        aria-hidden
        initial={shouldAnimate ? revealInitial : false}
        animate={revealFinal}
        transition={transition}
        className="absolute -inset-x-[var(--pad-sm)] -inset-y-[var(--pad-2xs)] -z-10"
      >
        <MarkerStroke
          data-problem-highlight-shape
          roughness={settings.contourRoughness}
          className="text-flame-50"
        />
      </motion.span>
      <motion.span
        data-problem-highlight-base
        initial={shouldAnimate ? { clipPath: "inset(0 0% 0 0)", opacity: 1 } : false}
        animate={baseFinal}
        transition={transition}
        className="relative inline-flex"
      >
        {children}
      </motion.span>
      <motion.span
        data-problem-highlight-text
        aria-hidden
        initial={shouldAnimate ? revealInitial : false}
        animate={revealFinal}
        transition={transition}
        className="absolute inset-0 z-10 inline-flex text-flame-400"
      >
        {children}
      </motion.span>
    </span>
  )
}

function AnimatedProblemCopy({
  lines,
  settings,
  animateEntrance,
  balanceLines = false,
}: {
  lines: CopySegment[][]
  settings: ProblemMotionSettings
  animateEntrance: boolean
  balanceLines?: boolean
}) {
  const prefersReducedMotion = useReducedMotion()
  const totalCharacters = lines.reduce(
    (total, line) => total + line.reduce((lineTotal, segment) => lineTotal + Array.from(segment.text).length, 0),
    0
  )
  const highlightDelay =
    settings.body.delay +
    Math.max(0, totalCharacters - 1) * settings.body.stagger +
    Math.max(0, lines.length - 1) * settings.body.lineBreakDelay +
    settings.highlight.delay
  const label = lines.map((line) => line.map((segment) => segment.text).join("")).join(" ")

  return (
    <>
      <span aria-hidden className="flex flex-col items-start">
        {lines.map((line, lineIndex) => (
          <span
            key={lineIndex}
            data-problem-line
            className={cn("block w-full", balanceLines && "text-balance")}
          >
            {line.map((segment, segmentIndex) => {
              const segmentStart =
                lines.slice(0, lineIndex).reduce(
                  (total, priorLine) =>
                    total + priorLine.reduce((sum, part) => sum + Array.from(part.text).length, 0),
                  0
                ) +
                line.slice(0, segmentIndex).reduce(
                  (total, part) => total + Array.from(part.text).length,
                  0
                )
              const tokens = segment.text.split(/(\s+)/)
              const characters = tokens.map((token, tokenIndex) => {
                if (!token) return null
                if (/^\s+$/.test(token)) {
                  const startsSegment = tokens.slice(0, tokenIndex).every((part) => !part)
                  const endsSegment = tokens.slice(tokenIndex + 1).every((part) => !part)
                  if (startsSegment && !segment.emphasis) {
                    return <React.Fragment key={tokenIndex}>{token}</React.Fragment>
                  }
                  if (segment.emphasis || endsSegment) {
                    return (
                      <span key={tokenIndex} className="inline-block whitespace-pre">
                        {token.replaceAll(" ", "\u00A0")}
                      </span>
                    )
                  }
                  return <React.Fragment key={tokenIndex}>{token}</React.Fragment>
                }

                const tokenStart = tokens.slice(0, tokenIndex).reduce(
                  (total, previous) => total + Array.from(previous).length,
                  0
                )
                return (
                  <span key={tokenIndex} className="inline-block whitespace-nowrap">
                    {Array.from(token).map((character, characterIndex) => {
                      const characterDelay =
                        settings.body.delay +
                        (segmentStart + tokenStart + characterIndex) * settings.body.stagger +
                        lineIndex * settings.body.lineBreakDelay

                      return (
                        <motion.span
                          key={`${lineIndex}-${segmentIndex}-${tokenIndex}-${characterIndex}`}
                          data-problem-character
                          className="inline-block"
                          initial={
                            animateEntrance && settings.body.enabled
                              ? {
                                  opacity: settings.body.opacityFrom,
                                  filter: prefersReducedMotion
                                    ? "blur(0px)"
                                    : `blur(${settings.body.blurFrom}px)`,
                                  transform: prefersReducedMotion
                                    ? "translateY(0)"
                                    : `translateY(${settings.body.offset}px)`,
                                }
                              : false
                          }
                          animate={{ opacity: 1, filter: "blur(0px)", transform: "translateY(0)" }}
                          transition={{ ...settings.body.transition, delay: characterDelay }}
                        >
                          {character}
                        </motion.span>
                      )
                    })}
                  </span>
                )
              })

              return segment.emphasis ? (
                <Emphasis
                  key={segmentIndex}
                  delay={highlightDelay}
                  settings={settings.highlight}
                  animateEntrance={animateEntrance}
                >
                  {characters}
                </Emphasis>
              ) : (
                <span
                  key={segmentIndex}
                  className={segment.nowrap ? "inline-block whitespace-nowrap" : undefined}
                >
                  {characters}
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

// Whether the md breakpoint applies, read through useSyncExternalStore. Each
// problem renders its copy twice (mobile and desktop line groups), with CSS
// hiding one. Only the visible copy runs the per-character entrance; the
// hidden one renders straight in its finished state, so the page animates
// half as many characters and nothing visible changes. The server snapshot
// doesn't matter: entrances only play after hydration.
const MD_QUERY = "(min-width: 48rem)"

function subscribeToMd(onChange: () => void) {
  const query = window.matchMedia(MD_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function useIsMd() {
  return React.useSyncExternalStore(
    subscribeToMd,
    () => window.matchMedia(MD_QUERY).matches,
    () => false
  )
}

function ProblemPanel({
  problem,
  active,
  animationKey,
  animateEntrance,
  settings,
}: {
  problem: Problem
  active: boolean
  animationKey: string
  animateEntrance: boolean
  settings: ProblemMotionSettings
}) {
  const isMd = useIsMd()
  const prefersReducedMotion = useReducedMotion()

  return (
    <article
      aria-hidden={!active}
      className={cn(
        "absolute inset-0 flex items-center justify-center px-[var(--pad-lg)]",
        active ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <div className="relative w-full max-w-(--landing-rail)">
        <motion.p
          key={`eyebrow-${animationKey}`}
          initial={
            animateEntrance && settings.eyebrow.enabled
              ? {
                  opacity: settings.eyebrow.opacityFrom,
                  filter: prefersReducedMotion ? "blur(0px)" : `blur(${settings.eyebrow.blurFrom}px)`,
                  transform: prefersReducedMotion
                    ? "translateY(0)"
                    : `translateY(${settings.eyebrow.offset}px)`,
                }
              : false
          }
          animate={{ opacity: 1, filter: "blur(0px)", transform: "translateY(0)" }}
          transition={{
            ...settings.eyebrow.transition,
            delay: settings.eyebrow.delay,
          }}
          className="mb-[var(--dist-lg)] font-display text-feature-eyebrow font-normal text-text-bold md:mb-[var(--dist-xl)] md:text-heading-sm-light"
        >
          {problem.eyebrow}
        </motion.p>
        <h2 key={`body-${animationKey}`} className="font-sans text-heading-md font-bold text-text-bold min-[24rem]:text-heading-lg md:text-body-2xl">
          <span className="md:hidden">
            <AnimatedProblemCopy
              lines={problem.mobileLines}
              settings={settings}
              animateEntrance={animateEntrance && !isMd}
              balanceLines
            />
          </span>
          <span className="hidden md:block">
            <AnimatedProblemCopy
              lines={problem.lines}
              settings={settings}
              animateEntrance={animateEntrance && isMd}
            />
          </span>
        </h2>
      </div>
    </article>
  )
}

function ProblemSequence() {
  const sectionRef = React.useRef<HTMLElement>(null)
  const [{ activeIndex, playKeys }, setSequenceState] = React.useState(() => ({
    activeIndex: null as number | null,
    playKeys: problems.map(() => 0),
  }))

  // The problems sit on one pinned stage, so they swap in place rather than
  // scrolling past each other. Scrolling and snapping are still entirely the
  // browser's: underneath the stage, one invisible full-screen stop per
  // problem scrolls normally and carries the snap point. This effect only
  // decides which problem the stage shows. A problem takes over once its stop
  // is within half a screen of the top, which is where mandatory snap will
  // settle anyway, so its entrance plays during the second half of the travel
  // rather than after it. Once the stage has scrolled off entirely nothing is
  // showing, so coming back replays the entrance.
  React.useEffect(() => {
    const section = sectionRef.current
    const scrollContainer = section?.closest<HTMLElement>("[data-landing-scroll]")
    if (!section || !scrollContainer) return
    const stops = Array.from(section.querySelectorAll<HTMLElement>("[data-problem-stop]"))

    const update = () => {
      const top = scrollContainer.scrollTop
      const height = scrollContainer.clientHeight
      const sequenceTop = section.offsetTop
      // Stop offsets are relative to the section (its offsetParent).
      const arriving = stops.findIndex(
        (stop) => Math.abs(sequenceTop + stop.offsetTop - top) < height / 2
      )
      if (arriving !== -1) {
        setSequenceState((state) =>
          state.activeIndex === arriving
            ? state
            : {
                activeIndex: arriving,
                playKeys: state.playKeys.map((key, index) => (index === arriving ? key + 1 : key)),
              }
        )
        return
      }
      const outOfView = top + height <= sequenceTop || top >= sequenceTop + section.offsetHeight
      if (outOfView) {
        setSequenceState((state) =>
          state.activeIndex === null ? state : { ...state, activeIndex: null }
        )
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
  }, [])

  return (
    <section ref={sectionRef} aria-label="Problems Presto solves" className="relative bg-surface-4">
      <div className="sticky top-0 h-(--landing-screen) overflow-hidden">
        {problems.map((problem, index) => (
          <ProblemPanel
            key={problem.eyebrow}
            problem={problem}
            active={index === activeIndex}
            animationKey={`${playKeys[index]}`}
            animateEntrance={playKeys[index] > 0}
            settings={PROBLEM_MOTION_SETTINGS}
          />
        ))}
      </div>
      {/* The stops are pulled up under the stage, so the section is exactly one
          screen per problem. snap-always keeps one flick from carrying the page
          past a problem. */}
      <div aria-hidden className="pointer-events-none -mt-(--landing-screen)">
        {problems.map((problem) => (
          <div key={problem.eyebrow} data-problem-stop className="h-(--landing-screen) snap-start snap-always" />
        ))}
      </div>
    </section>
  )
}

export { ProblemSequence }
