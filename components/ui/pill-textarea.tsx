"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ScrollbarThumb } from "@/components/ui/scrollbar-thumb"
import {
  HIDE_NATIVE_SCROLLBAR_CLASSNAME,
  useScrollThumb,
} from "@/hooks/use-scroll-thumb"
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
  ref,
  onScroll,
  "aria-invalid": ariaInvalid,
  ...props
}: PillTextareaProps) {
  // Same pattern as pill-input.tsx: aria-invalid, not a bespoke boolean prop,
  // so this composes with react-hook-form's own aria-invalid wiring and any
  // other caller that already treats aria-invalid as the source of truth.
  const isInvalid = ariaInvalid === true || ariaInvalid === "true"
  const { ref: squircleRef, style: squircleStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: CONTAINER_CORNER_RADIUS,
      cornerSmoothing: CORNER_SMOOTHING,
    })
  // Same app-wide custom scrollbar as everywhere else — see
  // hooks/use-scroll-thumb.ts. The thumb renders as a sibling of the
  // textarea inside this component's own `relative` wrapper, not inside the
  // textarea itself (which would just scroll away with the content).
  const {
    ref: scrollThumbRef,
    thumb,
    visible,
    onScroll: updateThumb,
  } = useScrollThumb<HTMLTextAreaElement>()

  const setTextareaRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      scrollThumbRef(node)
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [scrollThumbRef, ref]
  )

  return (
    <div
      ref={squircleRef}
      data-slot="pill-textarea"
      className={cn(
        // Same border strategy as pill-input: always present at full width,
        // transparent at rest, so the focus/danger swap never shifts layout.
        // rounded-rad-lg is the fallback shape until the squircle clip-path
        // is measured on mount (see use-squircle-clip-path.ts).
        "relative flex w-full rounded-rad-lg border-[length:var(--stroke-xl)] border-transparent bg-text-input-surface-rest px-pad-lg py-pad-sm transition-colors duration-150 ease has-[textarea:disabled]:bg-surface-2",
        // Same if/else exclusion pill-input.tsx uses for danger vs. focus
        // border color — including both risks the wrong one winning, since
        // they're equal-specificity classes whose actual precedence depends
        // on Tailwind's generated stylesheet order, not JSX order.
        isInvalid
          ? "border-border-danger"
          : "focus-within:border-border-focused",
        containerClassName
      )}
      style={squircleStyle}
    >
      <textarea
        ref={setTextareaRef}
        aria-invalid={ariaInvalid}
        onScroll={(event) => {
          updateThumb()
          onScroll?.(event)
        }}
        className={cn(
          // h-26 (104px) + the container's pad-sm padding = the Figma
          // TextArea's 120px overall height.
          "h-26 w-full resize-none bg-transparent text-body-lg text-text-bold outline-none placeholder:text-text-subtle disabled:text-text-subtle",
          HIDE_NATIVE_SCROLLBAR_CLASSNAME,
          className
        )}
        {...props}
      />
      <ScrollbarThumb thumb={thumb} visible={visible} className="right-1" />
    </div>
  )
}

export { PillTextarea }
