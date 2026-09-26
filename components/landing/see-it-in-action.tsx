"use client"

import * as React from "react"
import Image from "next/image"
import { Play } from "@phosphor-icons/react"
import { getSvgPath } from "figma-squircle"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

const WALKTHROUGH_POSTER = "/images/landing/see-it-in-action.webp"
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

function getYouTubeEmbedUrl(value: string) {
  try {
    const url = new URL(value, "https://presto.local")
    const host = url.hostname.replace(/^www\./, "")
    let videoId: string | null = null

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? null
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") videoId = url.searchParams.get("v")
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] ?? null
      }
    }

    return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}`
      : null
  } catch {
    return null
  }
}

function WalkthroughMedia({
  videoUrl,
  fallbackVideoUrl,
}: {
  videoUrl?: string
  fallbackVideoUrl?: string
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [hasStarted, setHasStarted] = React.useState(false)
  const youtubeEmbedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null

  React.useEffect(() => {
    const video = videoRef.current
    const featuresArea = video?.closest<HTMLElement>("[data-landing-features-scroll]")
    const scrollArea = video?.closest<HTMLElement>("[data-landing-scroll]")
    if (!video || !featuresArea || !scrollArea) return

    let fullscreen = false
    let savedFeaturesTop: number | null = null
    let restoreFrame = 0
    let settleFrame = 0
    let restoreTimeout = 0

    const rememberPosition = () => {
      if (!fullscreen) savedFeaturesTop = featuresArea.scrollTop
    }

    const restorePosition = () => {
      if (savedFeaturesTop === null) return
      const featuresTop =
        scrollArea.scrollTop +
        featuresArea.getBoundingClientRect().top -
        scrollArea.getBoundingClientRect().top
      scrollArea.scrollTop = featuresTop
      featuresArea.scrollTop = savedFeaturesTop
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
        savedFeaturesTop = null
      }, 120)
    }

    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement
      if (fullscreenElement === video || fullscreenElement?.contains(video)) {
        cancelPendingRestore()
        if (savedFeaturesTop === null) rememberPosition()
        fullscreen = true
      } else {
        leaveFullscreen()
      }
    }

    const beginWebkitFullscreen = () => {
      cancelPendingRestore()
      if (savedFeaturesTop === null) rememberPosition()
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

  if (youtubeEmbedUrl) {
    return (
      <iframe
        title="Presto product walkthrough"
        src={youtubeEmbedUrl}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="aspect-[212/141] w-full border-0"
      />
    )
  }

  if (videoUrl) {
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
          className="block h-full w-full bg-surface-4 object-cover"
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

  return (
    <Image
      src={WALKTHROUGH_POSTER}
      alt="Presto Generate screen with calendar-based post scheduling controls"
      width={1696}
      height={1128}
      sizes="(min-width: 768px) 848px, calc(100vw - 44px)"
      className="block h-auto w-full"
    />
  )
}

function SeeItInAction({
  videoUrl,
  fallbackVideoUrl,
}: {
  videoUrl?: string
  fallbackVideoUrl?: string
}) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({ cornerRadius: 16 })

  return (
    <section
      id="how-it-works"
      aria-labelledby="see-it-in-action-heading"
      className="bg-surface-4 px-[var(--mgn-mobile)] py-pad-6xl md:px-pad-6xl md:py-[calc(var(--pad-7xl)-var(--pad-sm))]"
    >
      <div className="mx-auto w-full max-w-[848px]">
        <h2
          id="see-it-in-action-heading"
          className="mb-dist-3xl font-display text-heading-sm-light font-normal text-text-bold"
        >
          See it in action . . .
        </h2>

        <div className="rounded-rad-lg shadow-[0_var(--pad-xs)_var(--pad-2xl)_rgba(0,0,0,0.1)]">
          <div
            ref={ref}
            style={style}
            className="relative overflow-hidden rounded-rad-lg bg-surface-4"
          >
            <WalkthroughMedia videoUrl={videoUrl} fallbackVideoUrl={fallbackVideoUrl} />
            <WalkthroughStroke />
          </div>
        </div>
      </div>
    </section>
  )
}

export { SeeItInAction }
