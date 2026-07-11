"use client"

import * as React from "react"
import {
  Check,
  Info,
  Warning,
  WarningOctagon,
  type Icon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma corner radius (app/globals.css --rad-xmd) matched to a pixel number
// here because the squircle path math needs actual px, not a CSS var — see
// hooks/use-squircle-clip-path.ts.
const TOAST_CORNER_RADIUS = 12
const CORNER_SMOOTHING = 1

// Figma component set (node 287:20020) confirmed via screenshot: 4 types,
// each with its own fixed icon — info/danger/success/warning. Danger uses
// the triangle Warning icon, warning uses the octagon WarningOctagon icon
// (Figma pairs them this way, not the more typical reverse). Success uses a
// plain Check, not CheckCircle as first guessed. Text renders uppercase via
// a text-style transform, not literal uppercase content. "info"'s purple has
// no semantic token (Button never had an info variant) — using the raw
// purple-500 ramp value as the closest visual match to the screenshot; the
// exact ramp step (400/500/600) wasn't confirmed and is a judgment call.
const toastVariants = {
  info: { className: "bg-purple-500", icon: Info },
  danger: { className: "bg-button-danger-primary-rest", icon: Warning },
  success: { className: "bg-button-success-primary-rest", icon: Check },
  warning: { className: "bg-button-warning-primary-rest", icon: WarningOctagon },
} satisfies Record<string, { className: string; icon: Icon }>

type ToastVariant = keyof typeof toastVariants

// Both the mount-in (@starting-style) and dismiss transforms move the toast
// by exactly its own size — translateY(100%)/translateX(100%) — the same
// technique Sonner uses to position toasts, so entry and exit share one
// lookup instead of duplicating the per-direction values.
const directionOffsetClasses = {
  top: { starting: "starting:-translate-y-full", exit: "-translate-y-full" },
  bottom: { starting: "starting:translate-y-full", exit: "translate-y-full" },
  left: { starting: "starting:-translate-x-full", exit: "-translate-x-full" },
  right: { starting: "starting:translate-x-full", exit: "translate-x-full" },
} as const

type ToastDirection = keyof typeof directionOffsetClasses

// Matches the transition's own duration/ease-out below — how long the exit
// animation needs to finish playing before the toast actually leaves the DOM.
const EXIT_DURATION = 200

interface ToastProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant?: ToastVariant
  direction?: ToastDirection
  duration?: number
  className?: string
  children: React.ReactNode
}

function Toast({
  open,
  onOpenChange,
  variant = "success",
  direction = "top",
  duration = 4000,
  className,
  children,
}: ToastProps) {
  const [prevOpen, setPrevOpen] = React.useState(open)
  const [mounted, setMounted] = React.useState(open)
  const [isVisible, setIsVisible] = React.useState(open)
  const { ref: squircleRef, style: squircleStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: TOAST_CORNER_RADIUS,
      cornerSmoothing: CORNER_SMOOTHING,
    })

  // Presence pattern: closing doesn't unmount immediately. It first flips the
  // toast to its exit position/opacity — a style change on an already-
  // mounted element, so the transition actually plays — then unmounts once
  // that transition has had time to finish (the effect below).
  // @starting-style (used for the mount-in) has no symmetric "ending style,"
  // so exit has to be driven this way instead.
  // Adjusted during render (React's documented "adjusting state when a prop
  // changes" pattern) rather than in an effect, since it must be visible in
  // the very same commit that flips `open` — an effect would let that first
  // frame paint with the stale position, then jump.
  if (open !== prevOpen) {
    setPrevOpen(open)
    setIsVisible(open)
    if (open) setMounted(true)
  }

  React.useEffect(() => {
    if (open) return
    const timer = setTimeout(() => setMounted(false), EXIT_DURATION)
    return () => clearTimeout(timer)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => onOpenChange(false), duration)
    return () => clearTimeout(timer)
  }, [open, duration, onOpenChange])

  if (!mounted) return null

  const { className: variantClassName, icon: VariantIcon } = toastVariants[variant]
  const { starting, exit } = directionOffsetClasses[direction]

  return (
    <div
      ref={squircleRef}
      role="status"
      className={cn(
        // ease-out on the way in (starts fast, feels responsive), same
        // curve reused on the way out for consistency. Kept under the 300ms
        // UI ceiling both directions.
        // Tailwind v4's translate-* utilities animate the standalone CSS
        // `translate` property, not `transform` — transitioning `transform`
        // here would silently do nothing and the slide would just snap.
        // rounded-rad-xmd is the fallback shape until the squircle
        // clip-path is measured on mount (see use-squircle-clip-path.ts).
        "flex items-center gap-dist-sm rounded-rad-xmd px-pad-md py-pad-xs shadow-[0px_4px_16px_0px_rgba(0,0,0,0.25)] transition-[opacity,translate] duration-200 ease-out",
        isVisible
          ? cn("opacity-100", starting, "starting:opacity-0")
          : cn("opacity-0", exit),
        variantClassName,
        className
      )}
      style={squircleStyle}
    >
      <span className="flex shrink-0 items-center justify-center text-icon-inverse [&_svg]:size-5">
        <VariantIcon weight="bold" />
      </span>
      <p className="text-[length:var(--text-title-md)] leading-[var(--text-title-md--line-height)] tracking-[var(--text-title-md--letter-spacing)] font-display font-bold text-text-inverse uppercase">
        {children}
      </p>
    </div>
  )
}

export { Toast }
