import { cn } from "@/lib/utils"

// The Figma divider (design-sync instructions export, assets/line-*.svg) is a
// 1px line with stroke-dasharray "0.5 4" and round caps — round ~1px dots
// every 4.5px. CSS borders can't draw round-dot dashes, so this repeats a
// tiny radial gradient instead; those px numbers mirror the asset's dash
// geometry (not a design token), while the color is the border-bold token.
function DottedDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "h-px w-full shrink-0 bg-[radial-gradient(circle,var(--border-bold)_0.5px,transparent_0.5px)] [background-size:4.5px_1px] bg-repeat-x",
        className
      )}
    />
  )
}

export { DottedDivider }
