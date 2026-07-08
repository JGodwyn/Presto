import * as React from "react"
import { Warning } from "@phosphor-icons/react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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
          className="text-[length:var(--text-body-lg)] leading-[var(--text-body-lg--line-height)] tracking-[var(--text-body-lg--letter-spacing)] font-medium text-text-bold transition-colors duration-150 ease group-has-[input:disabled]/field:text-text-subtle"
        >
          {label}
        </label>
      ) : null}

      <div
        data-slot="pill-input"
        className={cn(
          // Border is always present at full width, just transparent at rest,
          // so swapping it in for focus/danger never shifts layout.
          // transition-colors eases the border/background swap instead of
          // snapping instantly between rest/focus/danger/disabled.
          "flex w-full items-center gap-dist-md rounded-rad-lg border-[length:var(--stroke-xl)] border-transparent bg-text-input-surface-rest py-pad-sm transition-colors duration-150 ease has-[input:disabled]:bg-surface-2",
          isInvalid
            ? "border-border-danger"
            : "focus-within:border-border-focused",
          sizeClasses[fieldSize]
        )}
      >
        {icon ? (
          <span className="flex shrink-0 items-center justify-center text-icon-subtle [&_svg]:size-5">
            {icon}
          </span>
        ) : null}
        <Input
          id={inputId}
          aria-invalid={ariaInvalid}
          className={cn(
            // Input's own defaults (h-8, rounded-lg, border, ring, text-base) use
            // Tailwind's built-in scale, which tailwind-merge can't reconcile
            // against our custom-named token utilities (e.g. h-pad-3xl) since it
            // doesn't know they belong to the same group — so these overrides use
            // bracket syntax against the same CSS vars to guarantee eviction.
            // The outer container now owns the visible border/background for
            // focus, danger, and disabled states, so the input's own variants
            // for those are neutralized here to avoid a second border/tint.
            // Chrome/Safari paint autofilled inputs with a UA background that
            // ignores plain background-color — only an inset box-shadow can
            // override it, which is why this can't just be another bg-* class.
            "h-auto flex-1 rounded-none border-0 bg-[var(--text-input-surface-rest)] p-0 text-[length:var(--text-body-lg)] leading-[var(--text-body-lg--line-height)] tracking-[var(--text-body-lg--letter-spacing)] font-medium text-text-bold placeholder:text-text-subtle focus-visible:border-0 focus-visible:ring-0 aria-invalid:border-0 aria-invalid:ring-0 disabled:bg-[var(--surface-2)] disabled:text-text-subtle disabled:opacity-100 autofill:shadow-[inset_0_0_0px_1000px_var(--text-input-surface-rest)] autofill:[-webkit-text-fill-color:var(--text-bold)] autofill:caret-text-bold",
            className
          )}
          {...props}
        />
        {suffix ? (
          <span className="shrink-0 text-[length:var(--text-body-lg)] leading-[var(--text-body-lg--line-height)] tracking-[var(--text-body-lg--letter-spacing)] font-medium text-text-subtle">
            {suffix}
          </span>
        ) : null}
        {isInvalid ? (
          // Conditionally mounted, so transition-colors can't smooth it in —
          // starting: (@starting-style) fades/scales it in on insertion instead.
          <span className="flex shrink-0 items-center justify-center text-icon-danger transition-[opacity,transform] duration-150 ease-out starting:scale-90 starting:opacity-0 [&_svg]:size-5">
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
        // one would survive.
        <p
          className={cn(
            "text-[length:var(--text-body-md-bold)] leading-[var(--text-body-md-bold--line-height)] tracking-[var(--text-body-md-bold--letter-spacing)] font-bold transition-[color,opacity,transform] duration-150 ease-out starting:-translate-y-0.5 starting:opacity-0",
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
