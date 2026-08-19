"use client"

import type * as React from "react"

import { DottedDivider } from "@/components/instructions/dotted-divider"
import { SocialIcon } from "@/components/shared/social-icon"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"
import type { PostPlatform } from "@/types/post"

// rad-lg. Squircle per AGENTS.md's corner-smoothing rule; rounded-rad-lg stays
// as the fallback shape until the clip-path is measured on mount.
const ROW_CORNER_RADIUS = 16

// One platform row from the Figma "Connect / Base" export: a surface-4 pill
// holding the brand mark and name on the left, the action on the right, and a
// dotted leader filling whatever space is left between them. The same row is
// reused for every state — only `action` changes (a Connect button, a
// Disconnect button, or plain "Coming soon" text), which is why it takes a
// node rather than a variant prop.
function PlatformRow({
  platform,
  label,
  action,
  className,
}: {
  platform: PostPlatform
  label: string
  action: React.ReactNode
  className?: string
}) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: ROW_CORNER_RADIUS,
  })

  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        // pl-pad-md/pr-pad-sm is the export's asymmetric padding: the button
        // sits closer to the edge than the icon does, since it has its own.
        "rounded-rad-lg bg-surface-4 py-pad-sm pr-pad-sm pl-pad-md",
        className
      )}
    >
      {/* The content band is pinned to pad-2xl (32px, a Button sm's own
          height) so every row is the export's 48px tall whatever its action
          is — without it a row whose action is plain text ("Coming soon")
          hugs to 40 and sits visibly shorter than its neighbour. */}
      <div className="flex min-h-[var(--pad-2xl)] items-center gap-dist-lg">
        <div className="flex shrink-0 items-center gap-dist-md">
          <SocialIcon platform={platform} className="size-5 shrink-0" />
          <span className="text-body-lg-bold text-text-bold">{label}</span>
        </div>

        {/* The leader is wrapped rather than given flex-1 directly:
            DottedDivider is w-full/shrink-0 by design, and letting a caller
            fight those with flex utilities depends on stylesheet order to
            resolve. */}
        <div className="min-w-0 flex-1">
          <DottedDivider />
        </div>

        <div className="shrink-0">{action}</div>
      </div>
    </div>
  )
}

export { PlatformRow, ROW_CORNER_RADIUS }
