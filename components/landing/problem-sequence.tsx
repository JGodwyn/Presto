"use client"

import * as React from "react"
import { animate, type AnimationPlaybackControls } from "motion"
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
const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1]
const SCROLL_TRANSITION_DURATION = 0.3
const MOBILE_SCROLL_TRANSITION_DURATION = 0.22
const WHEEL_GESTURE_GAP_MS = 200
const WHEEL_TAIL_DECAY_SAMPLES = 3
const WHEEL_RESTART_RISE_SAMPLES = 2
const WHEEL_NEW_DIRECTION_RISE_SAMPLES = 1
const WHEEL_REVERSE_SETTLE_GUARD_MS = 100
const WHEEL_RESTART_RATIO = 2
const WHEEL_RESTART_MIN_DELTA = 4
const TOUCH_INTENT_DISTANCE = 8

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
          className="mb-[var(--dist-lg)] font-display text-feature-eyebrow font-normal text-text-bold md:mb-[var(--dist-xl)] md:text-heading-sm-light"
        >
          {problem.eyebrow}
        </motion.p>
        <h2 key={`body-${animationKey}`} className="font-sans text-heading-md font-bold text-text-bold min-[24rem]:text-heading-lg md:text-body-2xl">
          <span className="md:hidden">
            <AnimatedProblemCopy
              lines={problem.mobileLines}
              settings={settings}
              animateEntrance={animateEntrance}
              balanceLines
            />
          </span>
          <span className="hidden md:block">
            <AnimatedProblemCopy
              lines={problem.lines}
              settings={settings}
              animateEntrance={animateEntrance}
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
  const isViewportAnimatingRef = React.useRef(false)
  const activeIndexRef = React.useRef(activeIndex)

  React.useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

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
    const heroSection = scrollContainer.querySelector<HTMLElement>('[data-landing-touch-stage="hero"]')
    const whoItsForSection = scrollContainer.querySelector<HTMLElement>("[data-who-its-for]")
    const featuresSection = scrollContainer.querySelector<HTMLElement>("#features")
    const featuresScrollArea = scrollContainer.querySelector<HTMLElement>(
      "[data-landing-features-scroll]"
    )
    const whoItsForViewport = problems.length + 1
    const featuresViewport = whoItsForViewport + 1

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
    let reverseStartedAfterGap = false
    let settledAt = Number.NEGATIVE_INFINITY
    let featuresNativeGesture = false
    let pendingViewport: number | null = null
    let touchGesture: {
      pointerId: number
      startX: number
      startY: number
      viewport: number
      committed: boolean
    } | null = null
    let featuresTouch: {
      identifier: number
      startX: number
      startY: number
      claimed: boolean
      committed: boolean
    } | null = null
    let nativeTouchStartedAfterWho = false
    const originalScrollSnapType = scrollContainer.style.scrollSnapType

    const featuresHaveOwnScroll = () =>
      !!featuresScrollArea && window.getComputedStyle(featuresScrollArea).display !== "contents"

    const featuresViewportTop = () => {
      const target = featuresHaveOwnScroll() ? featuresScrollArea : featuresSection
      if (!target) return Number.POSITIVE_INFINITY
      return (
        scrollContainer.scrollTop +
        target.getBoundingClientRect().top -
        scrollContainer.getBoundingClientRect().top
      )
    }

    const updateTouchActions = () => {
      const isTouch = window.matchMedia("(any-pointer: coarse)").matches
      if (heroSection) {
        const heroCanAdvance =
          heroSection.offsetHeight <= scrollContainer.clientHeight + 1 ||
          scrollContainer.scrollTop >=
            heroSection.offsetTop + heroSection.offsetHeight - scrollContainer.clientHeight - 1
        const touchAction = isTouch && heroCanAdvance ? "pinch-zoom" : ""
        if (heroSection.style.touchAction !== touchAction) {
          heroSection.style.touchAction = touchAction
        }
      }
      if (whoItsForSection) {
        const touchAction =
          isTouch &&
          whoItsForSection.offsetHeight <= scrollContainer.clientHeight + 1 &&
          Math.abs(scrollContainer.scrollTop - whoItsForSection.offsetTop) <= 1
            ? "pinch-zoom"
            : ""
        if (whoItsForSection.style.touchAction !== touchAction) {
          whoItsForSection.style.touchAction = touchAction
        }
      }
    }

    updateTouchActions()
    const touchStageObserver = new ResizeObserver(updateTouchActions)
    if (heroSection) touchStageObserver.observe(heroSection)
    if (whoItsForSection) touchStageObserver.observe(whoItsForSection)
    touchStageObserver.observe(scrollContainer)
    scrollContainer.addEventListener("scroll", updateTouchActions, { passive: true })

    const viewportTop = (viewport: number) => {
      if (viewport === 0) return 0
      if (viewport === whoItsForViewport && whoItsForSection) {
        return whoItsForSection.offsetTop
      }
      if (viewport === featuresViewport && featuresSection) {
        return featuresViewportTop()
      }
      return section.offsetTop + (viewport - 1) * scrollContainer.clientHeight
    }

    const currentViewport = () => {
      const position = scrollContainer.scrollTop
      const lastViewport = featuresSection
        ? featuresViewport
        : whoItsForSection
          ? whoItsForViewport
          : problems.length
      let closest = 0
      for (let viewport = 1; viewport <= lastViewport; viewport += 1) {
        if (
          Math.abs(position - viewportTop(viewport)) <
          Math.abs(position - viewportTop(closest))
        ) {
          closest = viewport
        }
      }
      return closest
    }

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
      pendingViewport = null
      settledAt = performance.now()
      pendingReverseDirection = 0
      reverseSamples = 0
      reverseRiseSamples = 0
      reverseLastDelta = 0
      reverseFloor = Number.POSITIVE_INFINITY
      reverseStartedAfterGap = false
      showViewport(viewport)
    }

    const navigateToViewport = (viewport: number, instant = false) => {
      const target = viewportTop(viewport)
      const isTouch = window.matchMedia("(any-pointer: coarse)").matches
      const fromViewport = pendingViewport ?? currentViewport()
      const reduceMotion =
        instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches

      if (viewport === featuresViewport && featuresHaveOwnScroll() && featuresScrollArea) {
        featuresScrollArea.scrollTop = 0
        featuresNativeGesture = false
      }

      navigationId += 1
      const id = navigationId
      scrollAnimation?.stop()
      isViewportAnimatingRef.current = true
      pendingViewport = viewport
      scrollContainer.style.scrollSnapType = "none"
      if (
        isTouch &&
        fromViewport > 0 &&
        fromViewport <= problems.length &&
        viewport > 0 &&
        viewport <= problems.length
      ) {
        showViewport(viewport)
      }

      if (reduceMotion) {
        scrollContainer.scrollTop = target
        finishNavigation(viewport, target, id)
      } else {
        scrollAnimation = animate(scrollContainer.scrollTop, target, {
          duration: isTouch ? MOBILE_SCROLL_TRANSITION_DURATION : SCROLL_TRANSITION_DURATION,
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

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return
      if (!event.isPrimary) {
        touchGesture = null
        return
      }
      touchGesture = null
      nativeTouchStartedAfterWho =
        !!whoItsForSection && scrollContainer.scrollTop > whoItsForSection.offsetTop + 1
      const target = event.target
      if (!(target instanceof Element)) return

      const stage = target.closest<HTMLElement>(
        '[data-landing-touch-stage="hero"], [data-landing-touch-stage="problems"], [data-who-its-for]'
      )
      if (!stage) return
      if (window.getComputedStyle(stage).touchAction !== "pinch-zoom") return

      const viewport =
        stage === heroSection
          ? 0
          : stage === whoItsForSection
            ? whoItsForViewport
            : Math.min(
                problems.length,
                Math.max(
                  1,
                  Math.round((scrollContainer.scrollTop - section.offsetTop) / scrollContainer.clientHeight) + 1
                )
              )
      touchGesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        viewport: pendingViewport ?? viewport,
        committed: false,
      }
    }

    const advanceTouchGesture = (event: PointerEvent) => {
      if (!touchGesture || event.pointerId !== touchGesture.pointerId) return
      if (touchGesture.committed) return
      const deltaX = event.clientX - touchGesture.startX
      const deltaY = event.clientY - touchGesture.startY
      if (Math.abs(deltaY) < TOUCH_INTENT_DISTANCE || Math.abs(deltaY) <= Math.abs(deltaX)) {
        return
      }

      touchGesture.committed = true
      const direction = deltaY < 0 ? 1 : -1
      const lastViewport = whoItsForSection
        ? touchGesture.viewport >= whoItsForViewport
          ? featuresViewport
          : whoItsForViewport
        : problems.length
      const viewport = Math.min(lastViewport, Math.max(0, touchGesture.viewport + direction))
      if (viewport !== touchGesture.viewport) navigateToViewport(viewport)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") advanceTouchGesture(event)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (!touchGesture || event.pointerId !== touchGesture.pointerId) return
      advanceTouchGesture(event)
      touchGesture = null
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (touchGesture?.pointerId === event.pointerId) touchGesture = null
    }

    const handleTouchStart = (event: TouchEvent) => {
      featuresTouch = null
      if (
        !featuresSection ||
        !whoItsForSection ||
        !window.matchMedia("(any-pointer: coarse)").matches ||
        event.touches.length !== 1 ||
        Math.abs(scrollContainer.scrollTop - featuresViewportTop()) > 1 ||
        (featuresHaveOwnScroll() && featuresScrollArea!.scrollTop > 1) ||
        !(event.target instanceof Element) ||
        !featuresSection.contains(event.target)
      ) {
        return
      }

      const touch = event.touches[0]
      featuresTouch = {
        identifier: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        claimed: false,
        committed: false,
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!featuresTouch) return
      if (event.touches.length !== 1) {
        featuresTouch = null
        return
      }
      const touch = event.touches[0]
      if (touch.identifier !== featuresTouch.identifier) return

      const deltaX = touch.clientX - featuresTouch.startX
      const deltaY = touch.clientY - featuresTouch.startY
      if (!featuresTouch.claimed) {
        if (deltaY <= 0 || deltaY <= Math.abs(deltaX)) {
          if (Math.abs(deltaY) >= TOUCH_INTENT_DISTANCE ||
              Math.abs(deltaX) >= TOUCH_INTENT_DISTANCE) {
            featuresTouch = null
          }
          return
        }
        featuresTouch.claimed = true
      }

      if (!event.cancelable) {
        return
      }
      event.preventDefault()
      if (!featuresTouch.committed && deltaY >= TOUCH_INTENT_DISTANCE) {
        featuresTouch.committed = true
        nativeTouchStartedAfterWho = false
        navigateToViewport(whoItsForViewport)
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (featuresTouch && !featuresTouch.committed) {
        const touch = Array.from(event.changedTouches).find(
          (item) => item.identifier === featuresTouch?.identifier
        )
        if (touch) {
          const deltaX = touch.clientX - featuresTouch.startX
          const deltaY = touch.clientY - featuresTouch.startY
          if (
            deltaY >= TOUCH_INTENT_DISTANCE &&
            deltaY > Math.abs(deltaX) &&
            Math.abs(scrollContainer.scrollTop - featuresViewportTop()) <= 1 &&
            (!featuresHaveOwnScroll() || featuresScrollArea!.scrollTop <= 1)
          ) {
            nativeTouchStartedAfterWho = false
            navigateToViewport(whoItsForViewport)
          }
        }
      }
      featuresTouch = null
    }

    const handleTouchCancel = () => {
      featuresTouch = null
    }

    const settleNativeTouch = () => {
      if (
        !window.matchMedia("(any-pointer: coarse)").matches ||
        isViewportAnimatingRef.current ||
        touchGesture
      ) {
        return
      }

      if (nativeTouchStartedAfterWho && whoItsForSection) {
        nativeTouchStartedAfterWho = false
        const whoItsForTop = whoItsForSection.offsetTop
        const featuresTop = featuresSection ? featuresViewportTop() : whoItsForTop + whoItsForSection.offsetHeight
        if (scrollContainer.scrollTop < featuresTop - 1) {
          const whoItsForFits = whoItsForSection.offsetHeight <= scrollContainer.clientHeight + 1
          if (whoItsForFits || scrollContainer.scrollTop < whoItsForTop - 1) {
            if (Math.abs(scrollContainer.scrollTop - whoItsForTop) > 1) {
              navigateToViewport(whoItsForViewport)
            }
          }
          return
        }
      }

      if (
        scrollContainer.scrollTop < section.offsetTop - 1 ||
        scrollContainer.scrollTop >= (whoItsForSection?.offsetTop ?? Number.POSITIVE_INFINITY) - 1
      ) {
        return
      }
      const viewport = Math.min(
        problems.length,
        Math.max(
          1,
          Math.round((scrollContainer.scrollTop - section.offsetTop) / scrollContainer.clientHeight) + 1
        )
      )
      if (Math.abs(scrollContainer.scrollTop - viewportTop(viewport)) > 1) {
        navigateToViewport(viewport)
      }
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0) return
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

      const beforeProblemSequence = scrollContainer.scrollTop < section.offsetTop - 1
      const whoItsForTop = whoItsForSection?.offsetTop ?? Number.POSITIVE_INFINITY
      const whoItsForOverflows =
        whoItsForSection &&
        whoItsForSection.offsetHeight > scrollContainer.clientHeight + 1
      const atWhoItsFor = scrollContainer.scrollTop >= whoItsForTop - 1
      const beyondWhoItsFor = scrollContainer.scrollTop > whoItsForTop + 1
      const atFeatures =
        featuresSection &&
        Math.abs(scrollContainer.scrollTop - featuresViewportTop()) <= 1
      const now = performance.now()
      const delta = Math.abs(event.deltaY)
      const direction = event.deltaY > 0 ? 1 : -1
      const gestureGap = now - lastWheelAt > WHEEL_GESTURE_GAP_MS

      const recordForwardTail = () => {
        if (gestureGap || lastDirection !== direction) {
          decaySamples = 0
          riseSamples = 0
          tailFloor = delta
        } else if (lastDelta > 0) {
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
          decaySamples >= WHEEL_TAIL_DECAY_SAMPLES &&
          riseSamples >= WHEEL_RESTART_RISE_SAMPLES &&
          delta >= WHEEL_RESTART_MIN_DELTA &&
          delta >= tailFloor * WHEEL_RESTART_RATIO
        lastWheelAt = now
        lastDelta = delta
        lastDirection = direction
        if (gestureGap || restartedAfterTail) {
          decaySamples = 0
          riseSamples = 0
          tailFloor = delta
        }
        return gestureGap || restartedAfterTail
      }

      // The presentation-style handler owns the moves into and out of Who's-it-for.
      // It consumes each arrival's inertia tail before releasing later sections
      // to native scrolling.
      if (
        !isViewportAnimatingRef.current &&
        (event.deltaY < 0 && beforeProblemSequence)
      ) {
        return
      }

      if (!isViewportAnimatingRef.current && beyondWhoItsFor) {
        if (!atFeatures || !featuresHaveOwnScroll() || !featuresScrollArea) return
        const atFeaturesCeiling = featuresScrollArea.scrollTop <= 1
        if (!atFeaturesCeiling) {
          recordForwardTail()
          if (direction < 0) featuresNativeGesture = false
          return
        }
        if (direction < 0) {
          featuresNativeGesture = false
          event.preventDefault()
          if (recordForwardTail()) navigateToViewport(whoItsForViewport)
          return
        }
        // The arrival gesture must finish before native Features scrolling begins.
        const freshFeaturesGesture = recordForwardTail()
        if (!featuresNativeGesture && gestureConsumed && !freshFeaturesGesture) {
          event.preventDefault()
        } else {
          featuresNativeGesture = true
          gestureConsumed = true
        }
        return
      }

      if (!isViewportAnimatingRef.current && event.deltaY > 0 && atWhoItsFor) {
        if (!featuresSection) return

        const freshExitGesture = recordForwardTail()
        const confirmedExit =
          now - settledAt >= WHEEL_REVERSE_SETTLE_GUARD_MS &&
          delta >= WHEEL_RESTART_MIN_DELTA &&
          freshExitGesture
        if (confirmedExit && whoItsForOverflows) return

        event.preventDefault()
        if (confirmedExit) {
          gestureConsumed = true
          navigateToViewport(featuresViewport)
        }
        return
      }

      event.preventDefault()

      if (isViewportAnimatingRef.current) {
        // Keep the tail shape while the destination is immutable, so a second
        // flick can be recognized as soon as the viewport has settled.
        if (direction === lastDirection) recordForwardTail()
        else lastWheelAt = now
        return
      }

      const oppositeDirection = lastDirection !== 0 && direction !== lastDirection
      let directionChanged = false

      if (oppositeDirection) {
        if (pendingReverseDirection === direction && !gestureGap) {
          reverseSamples += 1
          if (delta > reverseLastDelta * 1.1) reverseRiseSamples += 1
          reverseFloor = Math.min(reverseFloor, delta)
        } else {
          pendingReverseDirection = direction
          reverseSamples = 1
          reverseRiseSamples = 0
          reverseFloor = delta
          reverseStartedAfterGap = gestureGap
        }
        reverseLastDelta = delta

        // The first opposite sample after a real quiet gap is a new gesture;
        // within one stream, require a sustained rising reversal.
        const discreteReverse = gestureGap
        const confirmedTrackpadReverse =
          reverseStartedAfterGap &&
          reverseSamples >= 3 &&
          reverseRiseSamples >= WHEEL_NEW_DIRECTION_RISE_SAMPLES &&
          delta >= reverseFloor * 1.5
        directionChanged =
          now - settledAt >= WHEEL_REVERSE_SETTLE_GUARD_MS &&
          (discreteReverse ||
            (delta >= WHEEL_RESTART_MIN_DELTA && confirmedTrackpadReverse))
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
        reverseStartedAfterGap = false
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
        reverseStartedAfterGap = false
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
        now - settledAt >= WHEEL_REVERSE_SETTLE_GUARD_MS &&
        decaySamples >= WHEEL_TAIL_DECAY_SAMPLES &&
        riseSamples >= 3 &&
        delta >= 6 &&
        delta >= tailFloor * 3
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
      const fromViewport = currentViewport()
      const nextViewport = Math.min(
        whoItsForSection ? whoItsForViewport : problems.length,
        Math.max(0, fromViewport + direction)
      )

      if (nextViewport === fromViewport) return

      navigateToViewport(nextViewport)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      if (
        event.target instanceof Element &&
        event.target.closest("a, button, input, select, textarea, [contenteditable], [role='slider']")
      ) {
        return
      }

      const direction =
        event.key === "ArrowDown" || event.key === "PageDown" || event.key === " "
          ? event.key === " " && event.shiftKey ? -1 : 1
          : event.key === "ArrowUp" || event.key === "PageUp"
            ? -1
            : 0
      if (direction === 0) return

      if (
        featuresHaveOwnScroll() &&
        featuresScrollArea!.scrollTop > 1 &&
        scrollContainer.scrollTop >= featuresViewportTop() - 1
      ) {
        return
      }

      const fromViewport = currentViewport()
      const whoItsForTop = whoItsForSection?.offsetTop ?? Number.POSITIVE_INFINITY
      const inTallWhoItsFor =
        whoItsForSection &&
        whoItsForSection.offsetHeight > scrollContainer.clientHeight + 1 &&
        scrollContainer.scrollTop >= whoItsForTop - 1 &&
        scrollContainer.scrollTop < featuresViewportTop() - 1
      if (inTallWhoItsFor) {
        const lastFullViewTop =
          whoItsForTop + whoItsForSection.offsetHeight - scrollContainer.clientHeight
        if (direction > 0) {
          event.preventDefault()
          if (scrollContainer.scrollTop < lastFullViewTop - 1) {
            scrollContainer.scrollTop = lastFullViewTop
          } else if (featuresSection) {
            navigateToViewport(featuresViewport, true)
          }
          return
        }
        if (scrollContainer.scrollTop > whoItsForTop + 1) {
          event.preventDefault()
          scrollContainer.scrollTop = whoItsForTop
          return
        }
      }
      const lastViewport = featuresSection
        ? featuresViewport
        : whoItsForSection
          ? whoItsForViewport
          : problems.length
      if (
        (direction > 0 && fromViewport >= lastViewport) ||
        (direction < 0 && fromViewport === 0) ||
        (featuresSection && scrollContainer.scrollTop > featuresViewportTop() + 1)
      ) {
        return
      }

      event.preventDefault()
      gestureConsumed = false
      lastDirection = 0
      navigateToViewport(fromViewport + direction, true)
    }

    let previousGeometry = {
      height: scrollContainer.clientHeight,
      problemsTop: section.offsetTop,
      whoTop: whoItsForSection?.offsetTop ?? Number.POSITIVE_INFINITY,
      featuresTop: featuresViewportTop(),
    }
    const realignAfterResize = () => {
      const nextGeometry = {
        height: scrollContainer.clientHeight,
        problemsTop: section.offsetTop,
        whoTop: whoItsForSection?.offsetTop ?? Number.POSITIVE_INFINITY,
        featuresTop: featuresViewportTop(),
      }
      const previous = previousGeometry
      previousGeometry = nextGeometry
      if (
        !window.matchMedia("(any-pointer: coarse)").matches ||
        document.fullscreenElement ||
        (Math.abs(nextGeometry.height - previous.height) <= 1 &&
          Math.abs(nextGeometry.problemsTop - previous.problemsTop) <= 1 &&
          Math.abs(nextGeometry.whoTop - previous.whoTop) <= 1 &&
          Math.abs(nextGeometry.featuresTop - previous.featuresTop) <= 1)
      ) {
        return
      }

      if (isViewportAnimatingRef.current && pendingViewport !== null) {
        navigationId += 1
        scrollAnimation?.stop()
        scrollAnimation = null
        finishNavigation(pendingViewport, viewportTop(pendingViewport), navigationId)
        return
      }

      const position = scrollContainer.scrollTop
      if (position >= previous.problemsTop - 1 && position < previous.whoTop - 1) {
        const index =
          activeIndexRef.current ??
          Math.min(
            problems.length - 1,
            Math.max(0, Math.round((position - previous.problemsTop) / previous.height))
          )
        scrollContainer.scrollTop = nextGeometry.problemsTop + index * nextGeometry.height
        showViewport(index + 1)
      } else if (
        whoItsForSection &&
        whoItsForSection.offsetHeight <= nextGeometry.height + 1 &&
        Math.abs(position - previous.whoTop) < previous.height / 2
      ) {
        scrollContainer.scrollTop = nextGeometry.whoTop
        showViewport(whoItsForViewport)
      } else if (Math.abs(position - previous.featuresTop) < previous.height / 2) {
        scrollContainer.scrollTop = nextGeometry.featuresTop
        showViewport(featuresViewport)
      }
    }
    const geometryObserver = new ResizeObserver(realignAfterResize)
    geometryObserver.observe(scrollContainer)
    geometryObserver.observe(section)
    if (heroSection) geometryObserver.observe(heroSection)
    if (whoItsForSection) geometryObserver.observe(whoItsForSection)
    if (featuresScrollArea) geometryObserver.observe(featuresScrollArea)

    scrollContainer.addEventListener("wheel", handleWheel, { passive: false })
    scrollContainer.addEventListener("pointerdown", handlePointerDown)
    scrollContainer.addEventListener("pointermove", handlePointerMove)
    scrollContainer.addEventListener("pointerup", handlePointerUp)
    scrollContainer.addEventListener("pointercancel", handlePointerCancel)
    scrollContainer.addEventListener("touchstart", handleTouchStart, { passive: true })
    scrollContainer.addEventListener("touchmove", handleTouchMove, { passive: false })
    scrollContainer.addEventListener("touchend", handleTouchEnd)
    scrollContainer.addEventListener("touchcancel", handleTouchCancel)
    scrollContainer.addEventListener("scrollend", settleNativeTouch)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      scrollContainer.removeEventListener("wheel", handleWheel)
      scrollContainer.removeEventListener("pointerdown", handlePointerDown)
      scrollContainer.removeEventListener("pointermove", handlePointerMove)
      scrollContainer.removeEventListener("pointerup", handlePointerUp)
      scrollContainer.removeEventListener("pointercancel", handlePointerCancel)
      scrollContainer.removeEventListener("touchstart", handleTouchStart)
      scrollContainer.removeEventListener("touchmove", handleTouchMove)
      scrollContainer.removeEventListener("touchend", handleTouchEnd)
      scrollContainer.removeEventListener("touchcancel", handleTouchCancel)
      scrollContainer.removeEventListener("scrollend", settleNativeTouch)
      scrollContainer.removeEventListener("scroll", updateTouchActions)
      touchStageObserver.disconnect()
      geometryObserver.disconnect()
      if (heroSection) heroSection.style.touchAction = ""
      if (whoItsForSection) whoItsForSection.style.touchAction = ""
      window.removeEventListener("keydown", handleKeyDown)
      navigationId += 1
      scrollAnimation?.stop()
      isViewportAnimatingRef.current = false
      scrollContainer.style.scrollSnapType = originalScrollSnapType
    }
  }, [activateProblem])

  return (
    <section ref={sectionRef} data-landing-touch-stage="problems" aria-label="Problems Presto solves" className="relative h-[300svh]">
      <div className="sticky top-0 h-svh overflow-hidden bg-surface-4">
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
      <div aria-hidden className="pointer-events-none -mt-[100svh]">
        {problems.map((problem) => (
          <div key={problem.eyebrow} className="h-svh" />
        ))}
      </div>
    </section>
  )
}

export { ProblemSequence }
