"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useInView, useReducedMotion, type Transition } from "motion/react"

import { MarkerStroke } from "@/components/landing/marker-stroke"
import { Button } from "@/components/ui/button"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

type EntranceSettings = {
  enabled: boolean
  delay: number
  offset: number
  scaleFrom: number
  opacityFrom: number
  blurFrom: number
  transition: Transition
}

type HighlightSettings = {
  enabled: boolean
  contourRoughness: number
  delay: number
  opacityFrom: number
  blurFrom: number
  transition: Transition
}

type WhoItsForMotionSettings = {
  trigger: {
    amount: number
  }
  card: EntranceSettings
  highlight: HighlightSettings
  explanation: EntranceSettings
  button: EntranceSettings
}

const WHO_MOTION_SETTINGS: WhoItsForMotionSettings = {
  trigger: { amount: 0.35 },
  card: {
    enabled: true,
    delay: 0,
    offset: 20,
    scaleFrom: 0.95,
    opacityFrom: 0,
    blurFrom: 0,
    transition: { duration: 1.25, ease: EASE_OUT },
  },
  highlight: {
    enabled: true,
    contourRoughness: 0,
    delay: 0.5,
    opacityFrom: 1,
    blurFrom: 0,
    transition: { duration: 0.65, ease: EASE_OUT },
  },
  explanation: {
    enabled: true,
    delay: 0.1,
    offset: 20,
    scaleFrom: 0.95,
    opacityFrom: 0,
    blurFrom: 0,
    transition: { duration: 0.95, ease: EASE_OUT },
  },
  button: {
    enabled: true,
    delay: 0.25,
    offset: 20,
    scaleFrom: 0.95,
    opacityFrom: 0,
    blurFrom: 0,
    transition: { duration: 0.95, ease: EASE_OUT },
  },
}

function WhoItsFor() {
  const sectionRef = React.useRef<HTMLElement>(null)
  const settings = WHO_MOTION_SETTINGS
  const isInView = useInView(sectionRef, {
    once: true,
    amount: settings.trigger.amount,
  })
  const prefersReducedMotion = useReducedMotion()
  const { ref: cardRef, style: cardStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: 24 })
  const { ref: cardInnerRef, style: cardInnerStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: 16 })
  const shouldAnimateHighlight = settings.highlight.enabled
  const highlightInitial = {
    clipPath: prefersReducedMotion ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
    opacity: shouldAnimateHighlight ? settings.highlight.opacityFrom : 1,
    filter:
      shouldAnimateHighlight && !prefersReducedMotion
        ? `blur(${settings.highlight.blurFrom}px)`
        : "blur(0px)",
  }
  const highlightFinal = {
    clipPath: "inset(0 0% 0 0)",
    opacity: 1,
    filter: "blur(0px)",
  }
  const highlightTransition: Transition = prefersReducedMotion
    ? { duration: 0.2, ease: EASE_OUT, delay: 0 }
    : {
        ...settings.highlight.transition,
        delay: settings.highlight.delay,
      }
  const highlight = (text: string) => (
    <span data-who-highlight className="relative isolate inline-block max-w-full">
      <motion.span
        data-who-highlight-background
        aria-hidden
        initial={shouldAnimateHighlight ? highlightInitial : false}
        animate={!shouldAnimateHighlight || isInView ? highlightFinal : highlightInitial}
        transition={highlightTransition}
        className="absolute -inset-x-[var(--pad-sm)] -inset-y-[var(--pad-2xs)] -z-10"
      >
        <MarkerStroke
          data-who-highlight-shape
          roughness={settings.highlight.contourRoughness}
          className="text-purple-800"
        />
      </motion.span>
      <span className="relative">{text}</span>
      <motion.span
        data-who-highlight-text
        aria-hidden
        initial={shouldAnimateHighlight ? highlightInitial : false}
        animate={!shouldAnimateHighlight || isInView ? highlightFinal : highlightInitial}
        transition={highlightTransition}
        className="absolute inset-0 z-10 text-purple-200"
      >
        {text}
      </motion.span>
    </span>
  )
  const entrance = (item: EntranceSettings) => {
    const shouldAnimate = item.enabled
    const initialState = {
      opacity: shouldAnimate ? item.opacityFrom : 1,
      filter:
        shouldAnimate && !prefersReducedMotion
          ? `blur(${item.blurFrom}px)`
          : "blur(0px)",
      transform:
        shouldAnimate && !prefersReducedMotion
          ? `translateY(${item.offset}px) scale(${item.scaleFrom})`
          : "translateY(0) scale(1)",
    }

    return {
      initial: shouldAnimate ? initialState : false,
      animate:
        !shouldAnimate || isInView
          ? {
              opacity: 1,
              filter: "blur(0px)",
              transform: "translateY(0) scale(1)",
            }
          : initialState,
      transition: prefersReducedMotion
        ? { duration: 0.2, ease: EASE_OUT, delay: 0 }
        : { ...item.transition, delay: item.delay },
    }
  }

  return (
    <section
      ref={sectionRef}
      data-who-its-for
      aria-labelledby="who-its-for-heading"
      className="flex min-h-svh shrink-0 flex-col items-center justify-center gap-[var(--dist-xl)] overflow-clip bg-surface-4 px-[var(--mgn-mobile)] py-[var(--pad-2xl)] md:h-svh md:gap-[var(--dist-2xl)] md:px-[var(--pad-6xl)] md:py-[var(--pad-6xl)]"
    >
      <motion.div
        ref={cardRef}
        style={cardStyle}
        {...entrance(settings.card)}
        className="w-full max-w-[848px] rounded-rad-xl bg-purple-700 p-[var(--pad-sm)]"
      >
        <div
          ref={cardInnerRef}
          style={cardInnerStyle}
          className="rounded-rad-lg bg-purple-500 px-[var(--pad-lg)] py-[var(--pad-xl)] md:px-[var(--pad-3xl)] md:py-[var(--pad-2xl)]"
        >
          <p className="mb-[var(--dist-xl)] font-display text-feature-eyebrow font-normal text-text-inverse md:text-heading-sm-light">
            Built for one person
          </p>
          <h2
            id="who-its-for-heading"
            className="font-sans text-heading-sm font-semibold leading-[calc(var(--pad-2xl)+var(--pad-xs))] text-text-inverse md:text-heading-md md:leading-[var(--text-heading-md--line-height)]"
          >
            Presto is for designers, consultants, and founders who{" "}
            <span className="md:hidden">
              {highlight("post")} {highlight("under their own name")}
            </span>
            <span className="hidden md:inline">
              {highlight("post under their own name")}
            </span>{" "}
            and don&apos;t have a content team behind them.
          </h2>
        </div>
      </motion.div>

      <motion.div
        {...entrance(settings.explanation)}
        className="flex w-full max-w-[848px] items-start gap-[var(--dist-md)] md:gap-[var(--dist-xl)]"
      >
        <Image
          src="/images/landing/who-its-for-info.svg"
          alt=""
          aria-hidden
          width={40}
          height={40}
          className="size-pad-2xl shrink-0 md:size-pad-3xl"
        />
        <p className="font-sans text-title-lg font-semibold text-text-subtle md:text-heading-md">
          If you&apos;re managing five client accounts or running approvals through a
          marketing lead, this isn&apos;t the tool. Go find something built for teams.
        </p>
      </motion.div>

      <motion.div
        {...entrance(settings.button)}
      >
        <span className="inline-flex drop-shadow-[0_var(--dist-md)_var(--dist-lg)_color-mix(in_srgb,var(--button-brand-primary-rest)_40%,transparent)]">
          <Button
            variant="brand"
            size="xl"
            nativeButton={false}
            className="h-[var(--pad-3xl)] w-[calc(100vw-var(--mgn-mobile)*2)] max-w-full md:w-[272px]"
            render={<Link href="/signup" />}
          >
            Get started
          </Button>
        </span>
      </motion.div>
    </section>
  )
}

export { WhoItsFor }
