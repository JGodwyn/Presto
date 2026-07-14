"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma "TextArea" (design-sync instructions export): the same pill surface
// as "TextField"/pill-input — --rad-lg squircle over TextInput/surface-rest —
// at a fixed height with top-aligned text. Radius matched to a pixel number
// here because the squircle path math needs actual px, not a CSS var — see
// hooks/use-squircle-clip-path.ts.
const CONTAINER_CORNER_RADIUS = 16
const CORNER_SMOOTHING = 1

interface PillTextareaProps extends React.ComponentProps<"textarea"> {
  containerClassName?: string
}

function PillTextarea({
  className,
  containerClassName,
  ...props
}: PillTextareaProps) {
  const { ref: squircleRef, style: squircleStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: CONTAINER_CORNER_RADIUS,
      cornerSmoothing: CORNER_SMOOTHING,
    })

  return (
    <div
      ref={squircleRef}
      data-slot="pill-textarea"
      className={cn(
        // Same border strategy as pill-input: always present at full width,
        // transparent at rest, so the focus swap never shifts layout.
        // rounded-rad-lg is the fallback shape until the squircle clip-path
        // is measured on mount (see use-squircle-clip-path.ts).
        "flex w-full rounded-rad-lg border-[length:var(--stroke-xl)] border-transparent bg-text-input-surface-rest px-pad-lg py-pad-sm transition-colors duration-150 ease focus-within:border-border-focused has-[textarea:disabled]:bg-surface-2",
        containerClassName
      )}
      style={squircleStyle}
    >
      <textarea
        className={cn(
          // h-26 (104px) + the container's pad-sm padding = the Figma
          // TextArea's 120px overall height.
          "h-26 w-full resize-none bg-transparent text-body-lg text-text-bold outline-none placeholder:text-text-subtle disabled:text-text-subtle",
          className
        )}
        {...props}
      />
    </div>
  )
}

export { PillTextarea }
