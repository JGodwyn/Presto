"use client"

import { Eyes } from "@phosphor-icons/react"

import type { PlatformSplit, TopicCount } from "@/lib/dashboard-summary"
import { cn } from "@/lib/utils"
import { Chip } from "@/components/ui/chip"
import { SocialIcon } from "@/components/shared/social-icon"
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/dashboard/dashboard-card"

// The bar colours are each platform's own brand, taken literally from the
// export — the same documented exception as file-type-icon.tsx's per-extension
// tags, and for the same reason: a brand mark's colour isn't ours to
// tokenise. X and TryOn happen to land on real tokens (Gray/Purple), so those
// use the token utilities; only LinkedIn's blue is a literal.
const PLATFORM_BARS = {
  linkedin: { track: "bg-[#cfe5fc]", fill: "bg-[#0a66c2]" },
  x: { track: "bg-gray-50", fill: "bg-gray-1000" },
  tryon: { track: "bg-purple-50", fill: "bg-purple-600" },
} as const

type PlatformRowKey = keyof typeof PLATFORM_BARS

function PlatformRow({
  platform,
  label,
  count,
  total,
}: {
  platform: PlatformRowKey
  label: string
  count: number
  total: number
}) {
  const share = total === 0 ? 0 : Math.round((count / total) * 100)
  const bar = PLATFORM_BARS[platform]

  return (
    <div className="flex flex-col gap-dist-sm">
      <div className="flex items-center gap-dist-md">
        {/* TryOn has no brand mark of its own yet, so it borrows the export's
            own choice: the Eyes glyph, at icon-subtle. */}
        {platform === "tryon" ? (
          <Eyes weight="bold" className="size-4 shrink-0 text-icon-subtle" />
        ) : (
          <SocialIcon platform={platform} className="size-4 shrink-0" />
        )}
        <span
          className={cn("h-2 min-w-0 flex-1 overflow-hidden rounded-full", bar.track)}
        >
          <span
            className={cn("block h-full rounded-full", bar.fill)}
            style={{ width: `${share}%` }}
          />
        </span>
      </div>
      <div className="flex items-center gap-dist-sm">
        <span className="text-body-lg text-text-bold">{label}</span>
        <span className="text-body-md text-text-subtle">•</span>
        <span className="text-body-lg-bold text-text-subtle">
          {count} {count === 1 ? "post" : "posts"}
        </span>
        <span className="text-body-md text-text-subtle">•</span>
        <span className="text-body-lg-bold text-text-subtle">{share}%</span>
      </div>
    </div>
  )
}

export function PostingAboutCard({
  topics,
  split,
  total,
  className,
}: {
  topics: TopicCount[]
  split: PlatformSplit
  total: number
  className?: string
}) {
  return (
    <DashboardCard className={cn("gap-dist-lg", className)}>
      <DashboardCardTitle>What you&rsquo;re posting about</DashboardCardTitle>

      {topics.length === 0 ? (
        <p className="text-body-md text-text-subtle">
          These posts carry no topics yet. Add some under Instructions and they
          come through on the next generation.
        </p>
      ) : (
        <div className="flex flex-wrap gap-dist-md">
          {topics.map(({ topic, count }) => (
            // The export's chip is Chip's unselected variant exactly —
            // surface-3, 2px border-subtle, rad-md. Only the label/count colour
            // split is per-call, so it's set on the spans here.
            <Chip key={topic} selected={false} title={`${count} posts`}>
              <span className="text-text-bold">{topic}</span>
              <span className="px-dist-sm text-body-md text-text-subtle">•</span>
              <span className="text-text-subtle">{count}</span>
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-dist-lg">
        <PlatformRow
          platform="linkedin"
          label="LinkedIn"
          count={split.linkedin}
          total={total}
        />
        <PlatformRow platform="x" label="X" count={split.x} total={total} />
        {/* Placeholder. TryOn is a generation type being added on another
            branch; `types/post.ts`'s PostPlatform is still linkedin | x, and
            that file is shared, so nothing here invents a value for it. The row
            renders at zero until that branch lands, at which point this reads
            its real count the same way the other two do. */}
        <PlatformRow platform="tryon" label="TryOn" count={0} total={total} />
      </div>
    </DashboardCard>
  )
}
