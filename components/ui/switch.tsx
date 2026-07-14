"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma "Toggle" (design-sync instructions export): a 56×28 track with a
// 32×20 knob inset 4px on every side. Radii (--rad-xmd track, --rad-md knob)
// matched to pixel numbers here because the squircle path math needs actual
// px, not a CSS var — see hooks/use-squircle-clip-path.ts.
const TRACK_CORNER_RADIUS = 12
const THUMB_CORNER_RADIUS = 8
const CORNER_SMOOTHING = 1

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const track = useSquircleClipPath<HTMLElement>({
    cornerRadius: TRACK_CORNER_RADIUS,
    cornerSmoothing: CORNER_SMOOTHING,
  })
  const thumb = useSquircleClipPath<HTMLElement>({
    cornerRadius: THUMB_CORNER_RADIUS,
    cornerSmoothing: CORNER_SMOOTHING,
  })

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      ref={track.ref}
      style={track.style}
      className={cn(
        // rounded-rad-* classes are the fallback shape until the squircle
        // clip-path is measured on mount (see use-squircle-clip-path.ts).
        // Color change → `ease` per the animation standards' easing table
        // (ease-out is for enter/exit, not color swaps).
        "inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-rad-xmd bg-toggle-surface-unchecked p-pad-xs transition-colors duration-150 ease outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-toggle-surface-checked data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        ref={thumb.ref}
        style={thumb.style}
        // Tailwind v4's translate-* utilities animate the standalone CSS
        // `translate` property, not `transform` — transitioning `transform`
        // here would silently do nothing and the knob would just snap.
        // The knob moves on screen (not enter/exit), so it gets the
        // standards' strong ease-in-out rather than ease-out; 150ms sits in
        // the press-feedback band. A transition (not keyframes) so rapid
        // re-toggling retargets mid-motion instead of restarting.
        className="h-5 w-8 rounded-rad-md bg-toggle-knob-rest transition-[translate] duration-150 ease-[cubic-bezier(0.77,0,0.175,1)] data-checked:translate-x-4"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
