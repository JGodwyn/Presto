"use client"

import * as React from "react"
import { animate, type AnimationPlaybackControls } from "motion"
import { motion, useReducedMotion, type Transition } from "motion/react"

import { MarkerStroke } from "@/components/landing/marker-stroke"
import { cn } from "@/lib/utils"

type Problem = {
  eyebrow: string
  lines: CopySegment[][]
}

type CopySegment = {
  text: string
  emphasis?: boolean
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]
const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1]
const SCROLL_TRANSITION_DURATION = 0.4
const WHEEL_GESTURE_GAP_MS = 180
const WHEEL_TAIL_DECAY_SAMPLES = 3
const WHEEL_RESTART_RISE_SAMPLES = 2
const WHEEL_REVERSE_SAMPLES = 3
const WHEEL_REVERSE_RISE_SAMPLES = 1
const WHEEL_REVERSE_RATIO = 1.4
const WHEEL_REVERSE_SETTLE_GUARD_MS = 100
const WHEEL_RESTART_RATIO = 1.6
const WHEEL_RESTART_MIN_DELTA = 4

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
    eyebrow: "Every posts starts from zero",
    lines: [
      [{ text: "You know what you want to say." }],
      [{ text: "Getting it into words takes" }],
      [{ text: "40 minutes", emphasis: true }, { text: " you don't have." }],
    ],
  },
  {
    eyebrow: "Ideas live in six places",
    lines: [
      [{ text: "Notes app, drafts folder, a voice" }],
      [{ text: "memo, a screenshot. " }, { text: "None", emphasis: true }, { text: " of" }],
      [{ text: "them are a plan." }],
    ],
  },
  {
    eyebrow: "Week three is where it dies",
    lines: [
      [{ text: "You post well for " }, { text: "two weeks", emphasis: true }, { text: ", get" }],
      [{ text: "busy with client work, and go" }],
      [{ text: "quiet for a month." }],
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
  problem,
  settings,
  animateEntrance,
}: {
  problem: Problem
  settings: ProblemMotionSettings
  animateEntrance: boolean
}) {
  const prefersReducedMotion = useReducedMotion()
  let characterIndex = 0
  const totalCharacters = problem.lines.reduce(
    (total, line) => total + line.reduce((lineTotal, segment) => lineTotal + Array.from(segment.text).length, 0),
    0
  )
  const highlightDelay =
    settings.body.delay +
    Math.max(0, totalCharacters - 1) * settings.body.stagger +
    Math.max(0, problem.lines.length - 1) * settings.body.lineBreakDelay +
    settings.highlight.delay
  const label = problem.lines.flatMap((line) => line.map((segment) => segment.text)).join(" ")

  return (
    <>
      <span aria-hidden className="flex flex-col items-start">
        {problem.lines.map((line, lineIndex) => (
          <span key={lineIndex} data-problem-line className="flex flex-wrap md:flex-nowrap">
            {line.map((segment, segmentIndex) => {
              const characters = Array.from(segment.text).map((character) => {
                const characterDelay =
                  settings.body.delay +
                  characterIndex * settings.body.stagger +
                  lineIndex * settings.body.lineBreakDelay
                characterIndex += 1

                return (
                  <motion.span
                    key={`${lineIndex}-${segmentIndex}-${characterIndex}`}
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
                    {character === " " ? "\u00A0" : character}
                  </motion.span>
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
                <span key={segmentIndex} className="inline-flex">
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
  const prefersReducedMotion = useReducedMotion()

  return (
    <article
      aria-hidden={!active}
      className={cn(
        "absolute inset-0 flex items-center justify-center px-[var(--pad-lg)]",
        active ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <div className="relative w-full max-w-[848px]">
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
          className="mb-[var(--dist-xl)] font-display text-heading-sm-light font-normal text-text-bold"
        >
          {problem.eyebrow}
        </motion.p>
        <h2 key={`body-${animationKey}`} className="font-sans text-body-2xl font-bold text-text-bold">
          <AnimatedProblemCopy
            problem={problem}
            settings={settings}
            animateEntrance={animateEntrance}
          />
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
  const isViewportAnimatingRef = React.useRef(false)

  const activateProblem = React.useCallback((nextIndex: number) => {
    setSequenceState((state) => {
      if (state.activeIndex === nextIndex) return state
      return {
        activeIndex: nextIndex,
        playKeys: state.playKeys.map((key, index) => (index === nextIndex ? key + 1 : key)),
      }
    })
  }, [])

  React.useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const scrollContainer = section.closest<HTMLElement>("[data-landing-scroll]")
    if (!scrollContainer) return

    const settle = () => {
      if (isViewportAnimatingRef.current) return
      const viewportHeight = scrollContainer.clientHeight
      const position = (scrollContainer.scrollTop - section.offsetTop) / viewportHeight

      if (scrollContainer.scrollTop < section.offsetTop - 1) {
        setSequenceState((state) =>
          state.activeIndex === null ? state : { ...state, activeIndex: null }
        )
        return
      }

      const nextIndex = Math.min(problems.length - 1, Math.max(0, Math.round(position)))
      const snapTop = section.offsetTop + nextIndex * viewportHeight
      if (Math.abs(scrollContainer.scrollTop - snapTop) <= 1) activateProblem(nextIndex)
    }

    settle()
    scrollContainer.addEventListener("scroll", settle, { passive: true })
    scrollContainer.addEventListener("scrollend", settle)
    window.addEventListener("resize", settle)
    return () => {
      scrollContainer.removeEventListener("scroll", settle)
      scrollContainer.removeEventListener("scrollend", settle)
      window.removeEventListener("resize", settle)
    }
  }, [activateProblem])

  React.useEffect(() => {
    const section = sectionRef.current
    const scrollContainer = section?.closest<HTMLElement>("[data-landing-scroll]")
    if (!section || !scrollContainer) return
    const whoItsForSection = scrollContainer.querySelector<HTMLElement>("[data-who-its-for]")
    const whoItsForViewport = problems.length + 1

    let targetViewport = Math.round(scrollContainer.scrollTop / scrollContainer.clientHeight)
    let navigationId = 0
    let scrollAnimation: AnimationPlaybackControls | null = null
    let gestureConsumed = false
    let lastWheelAt = Number.NEGATIVE_INFINITY
    let lastDelta = 0
    let lastDirection = 0
    let decaySamples = 0
    let riseSamples = 0
    let tailFloor = Number.POSITIVE_INFINITY
    let pendingReverseDirection = 0
    let reverseSamples = 0
    let reverseRiseSamples = 0
    let reverseLastDelta = 0
    let reverseFloor = Number.POSITIVE_INFINITY
    let settledAt = Number.NEGATIVE_INFINITY
    const originalScrollSnapType = scrollContainer.style.scrollSnapType

    const showViewport = (viewport: number) => {
      if (viewport === 0 || viewport > problems.length) {
        setSequenceState((state) =>
          state.activeIndex === null ? state : { ...state, activeIndex: null }
        )
      } else {
        activateProblem(viewport - 1)
      }
    }

    const finishNavigation = (viewport: number, target: number, id: number) => {
      if (id !== navigationId) return

      scrollContainer.scrollTop = target
      scrollContainer.style.scrollSnapType = originalScrollSnapType
      isViewportAnimatingRef.current = false
      settledAt = performance.now()
      if (viewport === whoItsForViewport) lastWheelAt = settledAt
      pendingReverseDirection = 0
      reverseSamples = 0
      reverseRiseSamples = 0
      reverseLastDelta = 0
      reverseFloor = Number.POSITIVE_INFINITY
      showViewport(viewport)
    }

    const navigateToViewport = (viewport: number) => {
      const viewportHeight = scrollContainer.clientHeight
      const target =
        viewport === whoItsForViewport && whoItsForSection
          ? whoItsForSection.offsetTop
          : viewport * viewportHeight
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

      navigationId += 1
      const id = navigationId
      scrollAnimation?.stop()
      targetViewport = viewport
      isViewportAnimatingRef.current = true
      scrollContainer.style.scrollSnapType = "none"

      if (reduceMotion) {
        scrollContainer.scrollTop = target
        finishNavigation(viewport, target, id)
      } else {
        scrollAnimation = animate(scrollContainer.scrollTop, target, {
          duration: SCROLL_TRANSITION_DURATION,
          ease: EASE_IN_OUT,
          onUpdate: (value) => {
            scrollContainer.scrollTop = value
          },
          onComplete: () => {
            scrollAnimation = null
            finishNavigation(viewport, target, id)
          },
        })
      }
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0) return
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

      const beforeProblemSequence = scrollContainer.scrollTop < section.offsetTop - 1
      const whoItsForTop = whoItsForSection?.offsetTop ?? Number.POSITIVE_INFINITY
      const atWhoItsFor = scrollContainer.scrollTop >= whoItsForTop - 1
      const beyondWhoItsFor = scrollContainer.scrollTop > whoItsForTop + 1
      const now = performance.now()
      const delta = Math.abs(event.deltaY)
      const direction = event.deltaY > 0 ? 1 : -1
      const gestureGap = now - lastWheelAt > WHEEL_GESTURE_GAP_MS

      // The presentation-style wheel handling owns one final move from Problem
      // 3 to the next full-viewport section. Its arriving gesture is consumed
      // through the inertia tail so native scrolling cannot briefly reveal the
      // following section before scroll snap corrects it. A distinct later
      // gesture, and all input below it, returns to native scrolling.
      if (
        !isViewportAnimatingRef.current &&
        (beyondWhoItsFor || (event.deltaY < 0 && beforeProblemSequence))
      ) {
        return
      }

      if (
        !isViewportAnimatingRef.current &&
        event.deltaY > 0 &&
        atWhoItsFor
      ) {
        if (gestureGap) return

        event.preventDefault()
        lastWheelAt = now
        lastDelta = delta
        lastDirection = direction
        return
      }

      event.preventDefault()

      if (isViewportAnimatingRef.current) {
        lastWheelAt = now
        return
      }

      const oppositeDirection = lastDirection !== 0 && direction !== lastDirection
      let directionChanged = false

      if (oppositeDirection) {
        if (pendingReverseDirection === direction) {
          reverseSamples += 1
          if (delta > reverseLastDelta * 1.1) reverseRiseSamples += 1
          reverseFloor = Math.min(reverseFloor, delta)
        } else {
          pendingReverseDirection = direction
          reverseSamples = 1
          reverseRiseSamples = 0
          reverseFloor = delta
        }
        reverseLastDelta = delta

        directionChanged =
          gestureGap ||
          (now - settledAt >= WHEEL_REVERSE_SETTLE_GUARD_MS &&
            reverseSamples >= WHEEL_REVERSE_SAMPLES &&
            reverseRiseSamples >= WHEEL_REVERSE_RISE_SAMPLES &&
            delta >= WHEEL_RESTART_MIN_DELTA &&
            delta >= reverseFloor * WHEEL_REVERSE_RATIO)
        if (!directionChanged) {
          lastWheelAt = now
          return
        }
      } else {
        pendingReverseDirection = 0
        reverseSamples = 0
        reverseRiseSamples = 0
        reverseLastDelta = 0
        reverseFloor = Number.POSITIVE_INFINITY
      }

      if (directionChanged) {
        decaySamples = 0
        riseSamples = 0
        tailFloor = delta
        pendingReverseDirection = 0
        reverseSamples = 0
        reverseRiseSamples = 0
        reverseLastDelta = 0
        reverseFloor = Number.POSITIVE_INFINITY
      } else if (gestureConsumed && lastDelta > 0) {
        if (delta < lastDelta) {
          decaySamples += 1
          riseSamples = 0
          tailFloor = Math.min(tailFloor, delta)
        } else if (
          decaySamples >= WHEEL_TAIL_DECAY_SAMPLES &&
          delta > lastDelta * 1.1
        ) {
          riseSamples += 1
        } else {
          riseSamples = 0
        }
      }

      const restartedAfterTail =
        !isViewportAnimatingRef.current &&
        decaySamples >= WHEEL_TAIL_DECAY_SAMPLES &&
        riseSamples >= WHEEL_RESTART_RISE_SAMPLES &&
        delta >= WHEEL_RESTART_MIN_DELTA &&
        delta >= tailFloor * WHEEL_RESTART_RATIO
      const isFreshGesture =
        !gestureConsumed || directionChanged || gestureGap || restartedAfterTail

      lastWheelAt = now
      lastDelta = delta
      lastDirection = direction
      if (!isFreshGesture) return

      gestureConsumed = true
      decaySamples = 0
      riseSamples = 0
      tailFloor = delta
      const currentViewport = isViewportAnimatingRef.current
        ? targetViewport
        : Math.round(scrollContainer.scrollTop / scrollContainer.clientHeight)
      const nextViewport = Math.min(
        whoItsForSection ? whoItsForViewport : problems.length,
        Math.max(0, currentViewport + direction)
      )

      if (nextViewport === currentViewport) return

      navigateToViewport(nextViewport)
    }

    scrollContainer.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      scrollContainer.removeEventListener("wheel", handleWheel)
      navigationId += 1
      scrollAnimation?.stop()
      isViewportAnimatingRef.current = false
      scrollContainer.style.scrollSnapType = originalScrollSnapType
    }
  }, [activateProblem])

  return (
    <section ref={sectionRef} aria-label="Problems Presto solves" className="relative h-[300dvh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-surface-4">
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
      <div aria-hidden className="pointer-events-none -mt-[100dvh]">
        {problems.map((problem) => (
          <div key={problem.eyebrow} className="h-dvh snap-start snap-always" />
        ))}
      </div>
    </section>
  )
}

export { ProblemSequence }
