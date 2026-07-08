"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"

import { cn } from "@/lib/utils"

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput>) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex w-full items-center gap-dist-md has-disabled:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex flex-1 items-center gap-dist-md", className)}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  error,
  className,
  ...props
}: React.ComponentProps<"div"> & { index: number; error?: boolean }) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } =
    inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      className={cn(
        // Border is always present at full width, transparent at rest, so
        // becoming active never shifts layout (same technique as PillInput).
        // Font size uses bracket syntax, not text-heading-md, because
        // tailwind-merge can't tell that custom-named text-* size and
        // text-* color utilities belong to different groups — combined
        // through cn() it silently drops one of them (see pill-input.tsx).
        "relative flex h-pad-6xl flex-1 items-center justify-center rounded-rad-lg border-[length:var(--stroke-xl)] bg-text-input-surface-rest text-[length:var(--text-heading-md)] leading-[var(--text-heading-md--line-height)] tracking-[var(--text-heading-md--letter-spacing)] font-display font-bold text-text-bold transition-colors duration-150 ease",
        error
          ? "border-border-danger"
          : isActive
            ? "border-border-focused"
            : "border-transparent",
        className
      )}
      {...props}
    >
      {char ?? <span className="text-text-minimal">•</span>}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[1.5rem] w-px animate-caret-blink bg-text-bold" />
        </div>
      )}
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot }
