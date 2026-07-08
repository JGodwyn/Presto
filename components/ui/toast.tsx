"use client"

import * as React from "react"
import { CheckCircle } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

// Figma component set only has a "success" type confirmed (node 287:20020) —
// the rate limit hit before other types (error/warning, if any) could be
// checked. Icon and label typography are inferred (CheckCircle, inverse
// text) from the partial spec available; worth confirming against the real
// component once it's reachable again.
const toastVariantClasses = {
  success: "bg-button-success-primary-rest",
} as const

type ToastVariant = keyof typeof toastVariantClasses

interface ToastProps {
  variant?: ToastVariant
  duration?: number
  onDismiss?: () => void
  className?: string
  children: React.ReactNode
}

function Toast({
  variant = "success",
  duration = 4000,
  onDismiss,
  className,
  children,
}: ToastProps) {
  React.useEffect(() => {
    if (!onDismiss) return
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [duration, onDismiss])

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-dist-sm rounded-rad-xmd px-pad-md py-pad-xs shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] transition-[opacity,transform] duration-200 ease-out starting:-translate-y-2 starting:opacity-0",
        toastVariantClasses[variant],
        className
      )}
    >
      <span className="flex shrink-0 items-center justify-center text-icon-inverse [&_svg]:size-5">
        <CheckCircle weight="bold" />
      </span>
      <p className="text-[length:var(--text-body-lg-bold)] leading-[var(--text-body-lg-bold--line-height)] tracking-[var(--text-body-lg-bold--letter-spacing)] font-bold text-text-inverse">
        {children}
      </p>
    </div>
  )
}

export { Toast }
