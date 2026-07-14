"use client"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma corner radius (app/globals.css --rad-lg) matched to a pixel number
// here because the squircle path math needs actual px, not a CSS var — see
// hooks/use-squircle-clip-path.ts.
const CARD_CORNER_RADIUS = 16
const CORNER_SMOOTHING = 1

interface InstructionsCardProps {
  title: string
  description: string
  className?: string
  children?: React.ReactNode
}

// Shared shell for the three Instructions cards (Figma "Instructions"
// export): white surface-4 card, Phudu title, subtle one-line description,
// then whatever the card holds, all on the card-level dist-lg rhythm.
function InstructionsCard({
  title,
  description,
  className,
  children,
}: InstructionsCardProps) {
  const { ref, style } = useSquircleClipPath<HTMLElement>({
    cornerRadius: CARD_CORNER_RADIUS,
    cornerSmoothing: CORNER_SMOOTHING,
  })

  return (
    <section
      ref={ref}
      style={style}
      className={cn(
        // rounded-rad-lg is the fallback shape until the squircle clip-path
        // is measured on mount (see use-squircle-clip-path.ts).
        "flex w-full flex-col gap-dist-lg rounded-rad-lg border-[length:var(--stroke-lg)] border-border-subtle bg-surface-4 px-pad-lg py-pad-md",
        className
      )}
    >
      <h2 className="text-heading-sm font-display text-text-bold">{title}</h2>
      <p className="text-body-lg text-text-subtle">{description}</p>
      {children}
    </section>
  )
}

export { InstructionsCard }
