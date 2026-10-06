"use client"

import * as React from "react"
import { Play } from "@phosphor-icons/react"
import { getSvgPath } from "figma-squircle"
import { motion, useReducedMotion, type Transition } from "motion/react"

import { useLandingArrival } from "@/hooks/use-landing-arrival"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

// The heading, then the video a beat later, sharpen in from a blur as the
// section arrives.
const ENTRANCE = {
  heading: { offset: 16, scaleFrom: 1, blurFrom: 8, transition: { duration: 0.8, ease: EASE_OUT } },
  video: {
    offset: 24,
    scaleFrom: 0.97,
    blurFrom: 12,
    transition: { duration: 1, ease: EASE_OUT, delay: 0.15 },
  },
} satisfies Record<string, { offset: number; scaleFrom: number; blurFrom: number; transition: Transition }>

const WALKTHROUGH_FIRST_FRAME = "/images/landing/landing-walkthrough-first-frame.webp"

function WalkthroughStroke() {
  const [path, setPath] = React.useState<string>()
  const [viewBox, setViewBox] = React.useState<string>()
  const [inset, setInset] = React.useState(0)
  const strokeRef = React.useCallback((element: SVGSVGElement | null) => {
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const box = Array.isArray(entry.borderBoxSize)
        ? entry.borderBoxSize[0]
        : entry.borderBoxSize
      const width = box.inlineSize
      const height = box.blockSize
      const strokeWidth = Number.parseFloat(
        getComputedStyle(element).getPropertyValue("--stroke-md")
      )
      const cornerRadius = Number.parseFloat(
        getComputedStyle(element).getPropertyValue("--rad-lg")
      )
      if (!width || !height || !strokeWidth || !cornerRadius) return

      // Draw the stroke inside the clipped edge so its antialiasing is not
      // clipped a second time by the media frame's squircle.
      const inset = strokeWidth
      setInset(inset)
      setViewBox(`0 0 ${width} ${height}`)
      setPath(
        getSvgPath({
          width: width - inset * 2,
          height: height - inset * 2,
          cornerRadius: cornerRadius - inset,
          cornerSmoothing: 1,
        })
      )
    })
    observer.observe(element, { box: "border-box" })
    return () => observer.disconnect()
  }, [])

  return (
    <svg
      ref={strokeRef}
      aria-hidden="true"
      viewBox={viewBox}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      {path ? (
        <path
          d={path}
          transform={`translate(${inset} ${inset})`}
          fill="none"
          stroke="var(--border-bold)"
          strokeWidth="var(--stroke-md)"
          shapeRendering="geometricPrecision"
        />
      ) : null}
    </svg>
  )
}

function getVideoType(value: string) {
  if (/\.webm(?:[?#]|$)/i.test(value)) return "video/webm"
  if (/\.mp4(?:[?#]|$)/i.test(value)) return "video/mp4"
  return undefined
}

function WalkthroughMedia({
  videoUrl,
  fallbackVideoUrl,
}: {
  videoUrl: string
  fallbackVideoUrl?: string
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [hasStarted, setHasStarted] = React.useState(false)

  React.useEffect(() => {
    const video = videoRef.current
    const scrollArea = video?.closest<HTMLElement>("[data-landing-scroll]")
    if (!video || !scrollArea) return

    // Leaving native fullscreen can resize the landing scroll area (Android
    // changes its svh geometry), which moves every section's offset. So the
    // position is kept as where the video sat on screen, not as a scrollTop,
    // and put back against the re-laid-out page.
    let fullscreen = false
    let savedVideoOffset: number | null = null
    let restoreFrame = 0
    let settleFrame = 0
    let restoreTimeout = 0

    const videoOffset = () =>
      video.getBoundingClientRect().top - scrollArea.getBoundingClientRect().top

    const rememberPosition = () => {
      if (!fullscreen) savedVideoOffset = videoOffset()
    }

    const restorePosition = () => {
      if (savedVideoOffset === null) return
      scrollArea.scrollTop += videoOffset() - savedVideoOffset
    }

    const cancelPendingRestore = () => {
      cancelAnimationFrame(restoreFrame)
      cancelAnimationFrame(settleFrame)
      clearTimeout(restoreTimeout)
    }

    const leaveFullscreen = () => {
      if (!fullscreen) return
      fullscreen = false
      // Android may resize the scrollports again after the fullscreen event.
      // Restore against their measured positions once layout has settled.
      restorePosition()
      restoreFrame = requestAnimationFrame(() => {
        restorePosition()
        settleFrame = requestAnimationFrame(restorePosition)
      })
      restoreTimeout = window.setTimeout(() => {
        restorePosition()
        savedVideoOffset = null
      }, 120)
    }

    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement
      if (fullscreenElement === video || fullscreenElement?.contains(video)) {
        cancelPendingRestore()
        if (savedVideoOffset === null) rememberPosition()
        fullscreen = true
      } else {
        leaveFullscreen()
      }
    }

    const beginWebkitFullscreen = () => {
      cancelPendingRestore()
      if (savedVideoOffset === null) rememberPosition()
      fullscreen = true
    }

    video.addEventListener("pointerdown", rememberPosition)
    video.addEventListener("touchstart", rememberPosition, { passive: true })
    video.addEventListener("keydown", rememberPosition)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    video.addEventListener("webkitbeginfullscreen", beginWebkitFullscreen)
    video.addEventListener("webkitendfullscreen", leaveFullscreen)

    return () => {
      video.removeEventListener("pointerdown", rememberPosition)
      video.removeEventListener("touchstart", rememberPosition)
      video.removeEventListener("keydown", rememberPosition)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      video.removeEventListener("webkitbeginfullscreen", beginWebkitFullscreen)
      video.removeEventListener("webkitendfullscreen", leaveFullscreen)
      cancelPendingRestore()
    }
  }, [videoUrl])

  return (
    <div className="relative aspect-[280/181] w-full">
      <video
        ref={videoRef}
        data-landing-walkthrough-video
        aria-label="Presto product walkthrough"
        controls={hasStarted}
        onPlay={() => setHasStarted(true)}
        playsInline
        preload="metadata"
        poster={WALKTHROUGH_FIRST_FRAME}
        className="block h-full w-full bg-text-bold object-contain"
      >
        <source src={videoUrl} type={getVideoType(videoUrl)} />
        {fallbackVideoUrl ? (
          <source src={fallbackVideoUrl} type={getVideoType(fallbackVideoUrl)} />
        ) : null}
        Your browser does not support embedded video.
      </video>
      {!hasStarted ? (
        <div className="absolute inset-0 flex items-center justify-center bg-text-bold/40">
          <button
            type="button"
            aria-label="Play Presto walkthrough"
            className="flex size-[calc(var(--pad-5xl)+var(--pad-lg))] cursor-pointer items-center justify-center rounded-full bg-text-bold/60 text-text-inverse transition-colors duration-150 hover:bg-text-bold/80 focus-visible:outline-2 focus-visible:outline-text-inverse [&_svg]:size-pad-2xl"
            onClick={() => {
              void videoRef.current?.play().catch(() => {})
            }}
          >
            <Play weight="fill" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SeeItInAction({
  videoUrl,
  fallbackVideoUrl,
}: {
  videoUrl: string
  fallbackVideoUrl?: string
}) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({ cornerRadius: 16 })
  const { ref: sectionRef, isInView } = useLandingArrival<HTMLElement>({ once: true })
  const prefersReducedMotion = useReducedMotion()

  // Plays on the first arrival only. Once visible it stays visible, so the
  // video is never hidden or remounted while it might be playing.
  const entrance = (item: (typeof ENTRANCE)[keyof typeof ENTRANCE]) => {
    const hidden = {
      opacity: 0,
      filter: prefersReducedMotion ? "blur(0px)" : `blur(${item.blurFrom}px)`,
      transform: prefersReducedMotion
        ? "translateY(0px) scale(1)"
        : `translateY(${item.offset}px) scale(${item.scaleFrom})`,
    }
    return {
      initial: hidden,
      animate: isInView
        ? { opacity: 1, filter: "blur(0px)", transform: "translateY(0px) scale(1)" }
        : hidden,
      transition: !isInView
        ? { duration: 0 }
        : prefersReducedMotion
          ? { duration: 0.2, ease: EASE_OUT }
          : item.transition,
    }
  }

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      aria-labelledby="see-it-in-action-heading"
      className="bg-surface-4 px-[var(--mgn-mobile)] pt-[calc(var(--pad-6xl)+var(--pad-3xl)*2)] pb-pad-6xl md:px-pad-6xl md:pt-[calc(var(--pad-7xl)-var(--pad-sm)+var(--pad-3xl)*2)] md:pb-[calc(var(--pad-7xl)-var(--pad-sm))]"
    >
      {/* Its own centred column, independent of the landing rail, with the
          heading centred over the video. */}
      <div className="mx-auto w-full max-w-[1080px]">
          <motion.h2
            {...entrance(ENTRANCE.heading)}
            id="see-it-in-action-heading"
            className="mb-dist-3xl text-center font-display text-heading-sm-light font-normal text-text-bold"
          >
            See it in action . . .
          </motion.h2>

          <motion.div
            {...entrance(ENTRANCE.video)}
            className="mx-auto w-full rounded-rad-lg shadow-[0_var(--pad-xs)_var(--pad-2xl)_rgba(0,0,0,0.1)]"
          >
            <div
              ref={ref}
              style={style}
              className="relative overflow-hidden rounded-rad-lg bg-surface-4"
            >
              <WalkthroughMedia videoUrl={videoUrl} fallbackVideoUrl={fallbackVideoUrl} />
              <WalkthroughStroke />
            </div>
          </motion.div>
      </div>
    </section>
  )
}

export { SeeItInAction }
