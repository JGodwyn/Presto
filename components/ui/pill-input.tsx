import * as React from "react"
import { Warning } from "@phosphor-icons/react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma corner radius (app/globals.css --rad-lg) matched to a pixel number
// here because the squircle path math needs actual px, not a CSS var — see
// hooks/use-squircle-clip-path.ts.
const CONTAINER_CORNER_RADIUS = 16
const CORNER_SMOOTHING = 1

// Figma "TextField" (node 41:326) sizes map straight onto existing pad tokens:
// sm = pad-2xl/pad-md, md = pad-3xl/pad-lg, lg = pad-4xl/pad-lg.
const sizeClasses = {
  sm: "h-pad-2xl px-pad-md",
  md: "h-pad-3xl px-pad-lg",
  lg: "h-pad-4xl px-pad-lg",
} as const

type PillInputSize = keyof typeof sizeClasses

interface PillInputProps extends React.ComponentProps<typeof Input> {
  icon?: React.ReactNode
  endAdornment?: React.ReactNode
  suffix?: string
  label?: string
  helperText?: string
  fieldSize?: PillInputSize
  containerClassName?: string
}

function PillInput({
  icon,
  endAdornment,
  suffix,
  label,
  helperText,
  fieldSize = "md",
  className,
  containerClassName,
  id,
  "aria-invalid": ariaInvalid,
  ...props
}: PillInputProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const isInvalid = ariaInvalid === true || ariaInvalid === "true"
  const { ref: squircleRef, style: squircleStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: CONTAINER_CORNER_RADIUS,
      cornerSmoothing: CORNER_SMOOTHING,
    })

  return (
    <div
      className={cn(
        "group/field flex w-full flex-col gap-dist-sm",
        containerClassName
      )}
    >
      {label ? (
        <label
          htmlFor={inputId}
          className="text-body-lg text-text-bold transition-colors duration-150 ease group-has-[input:disabled]/field:text-text-subtle"
        >
          {label}
        </label>
      ) : null}

      <div
        ref={squircleRef}
        data-slot="pill-input"
        className={cn(
          // Border is always present at full width, just transparent at rest,
          // so swapping it in for focus/danger never shifts layout.
          // transition-colors eases the border/background swap instead of
          // snapping instantly between rest/focus/danger/disabled.
          // rounded-rad-lg is the fallback shape until the squircle
          // clip-path is measured on mount (see use-squircle-clip-path.ts).
          "flex w-full items-center gap-dist-md rounded-rad-lg border-[length:var(--stroke-xl)] border-transparent bg-text-input-surface-rest py-pad-sm transition-colors duration-150 ease has-[input:disabled]:bg-surface-2",
          isInvalid
            ? "border-border-danger"
            : "focus-within:border-border-focused",
          sizeClasses[fieldSize]
        )}
        style={squircleStyle}
      >
        {icon ? (
          <span className="flex shrink-0 items-center justify-center text-icon-subtle [&_svg]:size-6">
            {icon}
          </span>
        ) : null}
        <Input
          id={inputId}
          aria-invalid={ariaInvalid}
          className={cn(
            // md:text-body-lg is not redundant: the base Input carries
            // shadcn's responsive `md:text-sm`, and tailwind-merge only
            // reconciles classes under the same variant — a bare text-body-lg
            // evicts Input's `text-base` but leaves `md:text-sm` standing,
            // silently shrinking the text (and placeholder) to 14px on
            // desktop widths.
            // The outer container owns the visible border/background for
            // focus, danger, and disabled states, so the input's own variants
            // for those are neutralized here to avoid a second border/tint.
            // Chrome/Safari paint autofilled inputs with a UA background that
            // ignores plain background-color — only an inset box-shadow can
            // override it, which is why this can't just be another bg-* class.
            "h-auto flex-1 rounded-none border-0 bg-text-input-surface-rest p-0 text-body-lg text-text-bold placeholder:text-text-subtle focus-visible:border-0 focus-visible:ring-0 aria-invalid:border-0 aria-invalid:ring-0 disabled:bg-surface-2 disabled:text-text-subtle disabled:opacity-100 autofill:shadow-[inset_0_0_0px_1000px_var(--text-input-surface-rest)] autofill:[-webkit-text-fill-color:var(--text-bold)] autofill:caret-text-bold md:text-body-lg",
            className
          )}
          {...props}
        />
        {suffix ? (
          <span className="shrink-0 text-body-lg text-text-subtle">
            {suffix}
          </span>
        ) : null}
        {isInvalid ? (
          // Conditionally mounted, so transition-colors can't smooth it in —
          // starting: (@starting-style) fades/scales it in on insertion instead.
          // Tailwind v4's scale-* utilities animate the standalone CSS
          // `scale` property, not `transform` — transitioning `transform`
          // here would silently do nothing.
          <span className="flex shrink-0 items-center justify-center text-icon-danger transition-[opacity,scale] duration-150 ease-out starting:scale-90 starting:opacity-0 [&_svg]:size-5">
            <Warning weight="bold" />
          </span>
        ) : null}
        {endAdornment ? (
          <span className="flex shrink-0 items-center justify-center text-icon-subtle [&_svg]:size-5">
            {endAdornment}
          </span>
        ) : null}
      </div>

      {helperText ? (
        // transition-colors and the mount-in fade both act on `color`, so
        // they're combined into one transition-property list — two separate
        // transition-* utilities here would fight in tailwind-merge and only
        // one would survive. Tailwind v4's translate-* utilities animate the
        // standalone CSS `translate` property, not `transform`.
        <p
          className={cn(
            "text-[length:var(--text-body-md-bold)] leading-[var(--text-body-md-bold--line-height)] tracking-[var(--text-body-md-bold--letter-spacing)] font-bold transition-[color,opacity,translate] duration-150 ease-out starting:-translate-y-0.5 starting:opacity-0",
            isInvalid ? "text-text-danger" : "text-text-subtle"
          )}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  )
}

export { PillInput }
