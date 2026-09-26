"use client"

import * as React from "react"
import Link from "next/link"
import { LinkedinLogo, XLogo } from "@phosphor-icons/react"
import { motion, useInView, useReducedMotion, type Transition } from "motion/react"

import { FooterGradient } from "@/components/landing/footer-gradient"
import { PrestoLogo } from "@/components/landing/presto-logo"
import { Button } from "@/components/ui/button"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

type FooterGradientOrder = "left-to-right" | "right-to-left" | "together"

type FooterGradientMotionSettings = {
  enabled: boolean
  delay: number
  stagger: number
  startHeight: number
  order: FooterGradientOrder
  transition: Transition
}

const FOOTER_ANIMATION: FooterGradientMotionSettings = {
  enabled: true,
  delay: 0.1,
  stagger: 0,
  startHeight: 0,
  order: "left-to-right",
  transition: { type: "spring", visualDuration: 0.85, bounce: 0 },
}

function sideOrderIndex(side: "left" | "right", order: FooterGradientOrder) {
  if (order === "together") return 0
  if (order === "right-to-left") return side === "right" ? 0 : 1
  return side === "left" ? 0 : 1
}

function FooterMark({
  label,
  href,
  children,
}: {
  label: string
  href: string
  children: React.ReactNode
}) {
  const { ref, style } = useSquircleClipPath<HTMLAnchorElement>({ cornerRadius: 8 })

  return (
    <a
      ref={ref}
      style={style}
      aria-label={label}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex size-pad-3xl items-center justify-center rounded-rad-md bg-purple-600 text-icon-inverse transition-colors duration-150 hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-6"
    >
      {children}
    </a>
  )
}

function LandingFooter() {
  const footerRef = React.useRef<HTMLElement>(null)
  const isInView = useInView(footerRef, { once: true, amount: 0.15 })
  const prefersReducedMotion = useReducedMotion()
  const animation = FOOTER_ANIMATION
  const shouldAnimate = animation.enabled && !prefersReducedMotion
  const gradientInitial = shouldAnimate
    ? { transform: `scaleY(${animation.startHeight})` }
    : false
  const gradientAnimate = {
    transform:
      !shouldAnimate || isInView
        ? "scaleY(1)"
        : `scaleY(${animation.startHeight})`,
  }
  const leftDelay =
    animation.delay + sideOrderIndex("left", animation.order) * animation.stagger
  const rightDelay =
    animation.delay + sideOrderIndex("right", animation.order) * animation.stagger

  return (
    <footer
      ref={footerRef}
      className="relative overflow-hidden bg-purple-700 px-[var(--mgn-mobile)] py-[calc(var(--pad-7xl)-var(--pad-sm))] md:min-h-[calc(var(--pad-9xl)*2+var(--pad-8xl)-var(--pad-xs))] md:px-pad-6xl"
    >
      <motion.div
        data-footer-gradient="left"
        className="pointer-events-none absolute top-[var(--pad-sm)] left-[calc(0px-var(--pad-9xl)-var(--pad-9xl)-var(--pad-md)-var(--pad-2xs)-var(--dist-2xl))] aspect-[2/3] w-[calc(var(--pad-9xl)*2+var(--pad-8xl)+var(--pad-lg)-var(--pad-2xs))] [--footer-gradient-late-color:var(--purple-500)] [--footer-gradient-end-color:var(--purple-400)] md:top-[calc(-1*(var(--pad-6xl)+var(--pad-sm)))] md:left-[calc(0px-var(--pad-9xl)-var(--pad-6xl)-var(--pad-2xl)+var(--pad-2xs))] md:[--footer-gradient-late-color:var(--lime-200)] md:[--footer-gradient-end-color:var(--flame-0)]"
        style={{ transformOrigin: "50% 100%" }}
        initial={gradientInitial}
        animate={gradientAnimate}
        transition={{ ...animation.transition, delay: leftDelay }}
      >
        <FooterGradient side="left" />
      </motion.div>
      <motion.div
        data-footer-gradient="right"
        className="pointer-events-none absolute top-[var(--pad-sm)] right-[calc(0px-var(--pad-9xl)-var(--pad-9xl)-var(--pad-md)+var(--dist-2xs)-var(--dist-2xl))] aspect-[2/3] w-[calc(var(--pad-9xl)*2+var(--pad-8xl)+var(--pad-lg)-var(--pad-2xs))] [--footer-gradient-late-color:var(--purple-500)] [--footer-gradient-end-color:var(--purple-400)] md:top-[calc(-1*(var(--pad-6xl)+var(--pad-sm)))] md:right-[calc(0px-var(--pad-9xl)-var(--pad-7xl)+var(--pad-md)-var(--pad-2xs))] md:[--footer-gradient-late-color:var(--lime-200)] md:[--footer-gradient-end-color:var(--flame-0)]"
        style={{ transformOrigin: "50% 100%" }}
        initial={gradientInitial}
        animate={gradientAnimate}
        transition={{ ...animation.transition, delay: rightDelay }}
      >
        <FooterGradient side="right" />
      </motion.div>

      <div className="relative z-10 mx-auto flex w-full max-w-[848px] flex-col gap-dist-3xl md:gap-dist-6xl">
        <div className="flex flex-col items-start gap-dist-xl">
          <p className="font-display text-feature-eyebrow leading-[var(--pad-2xl)] font-normal text-text-inverse">
            Write next month&apos;s posts this afternoon.
          </p>
          <h2 className="font-sans text-heading-md font-semibold text-purple-0 md:text-body-2xl md:leading-[calc(var(--pad-6xl)-var(--pad-xs))] md:font-semibold md:text-purple-200">
            Free while in beta. Takes about ten minutes to set up your voice, and
            you&apos;ll never do it again.
          </h2>
          <Button
            variant="brand"
            size="xl"
            nativeButton={false}
            className="w-full md:w-auto"
            render={<Link href="/signup" />}
          >
            Start generating now
          </Button>
        </div>

        <div className="flex flex-col items-start justify-between gap-dist-xl md:flex-row md:items-center">
          <div className="flex w-full items-center justify-between gap-dist-sm md:w-auto md:justify-start md:gap-dist-xl">
            <PrestoLogo />
            <div className="flex items-center gap-dist-sm min-[24rem]:gap-dist-lg">
              <FooterMark label="Godwin on LinkedIn" href="https://www.linkedin.com/in/gdwn/">
                <LinkedinLogo weight="fill" />
              </FooterMark>
              <FooterMark label="Godwin on X" href="https://x.com/gdwn__">
                <XLogo weight="bold" />
              </FooterMark>
            </div>
          </div>
          <p className="text-body-xl-bold text-text-inverse">©2026</p>
        </div>
      </div>
    </footer>
  )
}

export { LandingFooter }
