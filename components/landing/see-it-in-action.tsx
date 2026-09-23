"use client"

import Image from "next/image"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

const WALKTHROUGH_POSTER = "/images/landing/see-it-in-action.webp"

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

function WalkthroughMedia({ videoUrl }: { videoUrl?: string }) {
  const youtubeEmbedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null

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
      <video
        controls
        preload="metadata"
        poster={WALKTHROUGH_POSTER}
        className="aspect-[212/141] w-full bg-surface-4 object-cover"
      >
        <source src={videoUrl} />
        Your browser does not support embedded video.
      </video>
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

function SeeItInAction({ videoUrl }: { videoUrl?: string }) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({ cornerRadius: 16 })

  return (
    <section
      id="how-it-works"
      aria-labelledby="see-it-in-action-heading"
      className="bg-surface-4 px-[var(--mgn-mobile)] py-[calc(var(--pad-7xl)-var(--pad-sm))] md:px-pad-6xl"
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
            className="overflow-hidden rounded-rad-lg border-[length:var(--stroke-md)] border-border-bold bg-surface-4"
          >
            <WalkthroughMedia videoUrl={videoUrl} />
          </div>
        </div>
      </div>
    </section>
  )
}

export { SeeItInAction }
