"use client"

import * as React from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react"
import {
  Check,
  Info,
  Warning,
  WarningOctagon,
  type Icon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

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

// The slide used to be translate(±100%) — the element's own size, Sonner's
// technique. It's now a small px offset instead (dial-driven): the toast
// pops in place rather than flying in, so the distance only has to hint at
// where it came from. Sign/axis per direction; the same offset drives the
// exit, so it leaves the way it arrived.
const directionOffsets = {
  top: (distance: number) => ({ y: -distance }),
  bottom: (distance: number) => ({ y: distance }),
  left: (distance: number) => ({ x: -distance }),
  right: (distance: number) => ({ x: distance }),
} as const

type ToastDirection = keyof typeof directionOffsets

// STANDARDS.md's strong ease-out — built-in CSS curves are too weak.
const STRONG_EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

// These were tuned live on a DialKit panel and frozen here once the feel was
// right; the panel and its handles are gone (git history has them if the
// entrance ever needs re-tuning). Distances are px, durations seconds.
//
// The entrance spring's bounce is well past STANDARDS.md's "keep it 0.1-0.3"
// guidance — a deliberate call, since a pronounced pop is the point. At a
// 15px slide it carries ~3.8px past the resting position and peaks at scale
// 1.05 (~164ms in) before easing back. visualDuration is time-to-target
// rather than total settle, so it reads as 250ms even though the tail runs
// on to ~480ms.
const ENTER = {
  slide: 15,
  scale: 0.8,
  blur: 2,
  // Opacity is kept off the spring: a bouncing fade overshoots past 1
  // (clamped, so it just snaps opaque early) and reads as a flicker.
  fade: 0.15,
  transition: { type: "spring", bounce: 0.6, visualDuration: 0.25 },
} satisfies { transition: Transition } & Record<string, unknown>

// No spring on the way out — overshoot on an element that's leaving draws the
// eye back to something the user is done with.
const EXIT = {
  slide: 16,
  scale: 0.7,
  blur: 5,
  transition: { duration: 0.2, ease: STRONG_EASE_OUT },
} satisfies { transition: Transition } & Record<string, unknown>

// The extra-info capsule animates on its own clock rather than riding the
// wrapper: the toast lands first, then the capsule slides down and blurs in
// under it. `delay` is measured from the same instant the toast starts, so it
// has to exceed the toast's own visualDuration to read as arriving second.
// Its spring is gentler than the toast's (bounce 0.4 vs 0.6) — it carries
// ~2.8px past its resting position and peaks at scale 1.047 around 226ms in,
// leaving the capsule settled ~0.83s after the toast starts.
// Deliberately no exit of its own: the toast leaves as one object.
const EXTRA_INFO = {
  delay: 0.4,
  slide: 30,
  scale: 0.5,
  blur: 6,
  fade: 0.2,
  transition: { type: "spring", bounce: 0.4, visualDuration: 0.3 },
} satisfies { transition: Transition } & Record<string, unknown>

interface ToastProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant?: ToastVariant
  direction?: ToastDirection
  // `null` disables auto-dismiss, for a toast that reports an ongoing
  // condition rather than an event — it stays until whatever owns `open`
  // decides the condition is over (see the network-disconnected toast).
  duration?: number | null
  showIcon?: boolean
  // Rendered in the icon slot instead of the variant's fixed Figma icon —
  // for cases like an in-progress spinner that no variant provides.
  icon?: React.ReactNode
  // Secondary line (Figma "ToastWithExtraInfo"): a white capsule tucked under
  // the toast for supporting detail the headline can't carry — e.g. a spinner
  // plus "Trying to reconnect" under "Network disconnected". The capsule chrome
  // (surface, radius, padding, body-sm type) belongs to the toast; callers pass
  // only the content.
  extraInfo?: React.ReactNode
  className?: string
  children: React.ReactNode
}

function Toast({
  open,
  onOpenChange,
  variant = "success",
  direction = "top",
  duration = 4000,
  showIcon = true,
  icon,
  extraInfo,
  className,
  children,
}: ToastProps) {
  const prefersReducedMotion = useReducedMotion()

  React.useEffect(() => {
    if (!open || duration === null) return
    const timer = setTimeout(() => onOpenChange(false), duration)
    return () => clearTimeout(timer)
  }, [open, duration, onOpenChange])

  const { className: variantClassName, icon: VariantIcon } = toastVariants[variant]

  // Reduced motion keeps the toast appearing (it carries information) but
  // drops the position/scale change, per STANDARDS.md — fewer and gentler,
  // not zero.
  const offset = directionOffsets[direction]
  const enterState = prefersReducedMotion
    ? { opacity: 0 }
    : {
      opacity: 0,
      scale: ENTER.scale,
      filter: `blur(${ENTER.blur}px)`,
      ...offset(ENTER.slide),
    }
  const exitState = prefersReducedMotion
    ? { opacity: 0 }
    : {
      opacity: 0,
      scale: EXIT.scale,
      filter: `blur(${EXIT.blur}px)`,
      ...offset(EXIT.slide),
    }
  // The capsule's slide is always downward, unlike the toast's direction-aware
  // one: it starts tucked further up behind the toast and drops into place, so
  // it reads as emerging from underneath. A direction-aware offset would send
  // it sideways or upward, away from the toast it's annotating.
  const extraInfoEnterState = prefersReducedMotion
    ? { opacity: 0 }
    : {
      opacity: 0,
      y: -EXTRA_INFO.slide,
      scale: EXTRA_INFO.scale,
      filter: `blur(${EXTRA_INFO.blur}px)`,
    }

  return (
    // AnimatePresence rather than this file's old hand-rolled presence state
    // (@starting-style in, a class flip plus an unmount timer out): a spring
    // has no fixed duration, so there's no constant to time that unmount
    // against. It keeps the toast mounted until the exit actually finishes.
    <AnimatePresence>
      {open && (
        // The wrapper owns only presence (slide/scale/fade) and the column
        // that stacks the extra-info capsule under the toast; each capsule
        // paints its own shadow. Radius is rad-rd (a stadium), so unlike every
        // other card in the app there's no squircle clip-path here — a
        // fully-rounded shape has no straight edge for Figma's corner
        // smoothing to blend into, and figma-squircle's path math expects a
        // radius that fits inside the box.
        // Motion's x/y/scale shorthands aren't hardware-accelerated
        // (STANDARDS.md), but a spring has to interpolate numbers — it can't
        // run off a transform string. Accepted here: one small element,
        // animating occasionally.
        <motion.div
          role="status"
          className={cn("flex flex-col items-center", className)}
          initial={enterState}
          animate={{
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            x: 0,
            y: 0,
          }}
          exit={{ ...exitState, transition: EXIT.transition }}
          transition={{
            ...ENTER.transition,
            opacity: { duration: ENTER.fade, ease: STRONG_EASE_OUT },
          }}
        >
          <div
            className={cn(
              // relative + z-10 so the toast paints over the extra-info
              // capsule pulled up under it — both carry a drop-shadow filter,
              // which makes them stacking contexts painted in DOM order unless
              // z-index says otherwise, and DOM order alone would put the
              // capsule on top.
              "relative z-10 flex items-center gap-dist-sm rounded-full px-pad-md py-pad-xs",
              // Figma shadow (0 4 16, 25% black) as a filter rather than a
              // box-shadow so it traces the painted silhouette.
              "drop-shadow-[0px_4px_16px_rgba(0,0,0,0.25)]",
              variantClassName
            )}
          >
            {showIcon && (
              <span className="flex shrink-0 items-center justify-center text-icon-inverse [&_svg]:size-5">
                {icon ?? <VariantIcon weight="fill" />}
              </span>
            )}
            <p className="text-[length:var(--text-title-lg)] leading-[var(--text-title-lg--line-height)] tracking-[var(--text-title-lg--letter-spacing)] font-display font-bold text-text-inverse uppercase">
              {children}
            </p>
          </div>
          {extraInfo && (
            // Two elements again, and for a filter reason like the shadow/clip
            // split elsewhere in this codebase: blur() and drop-shadow() are
            // both the `filter` property, so animating blur inline on the
            // capsule itself would replace its shadow outright (and leave it
            // replaced, since Motion parks `filter: blur(0px)` there when it
            // finishes). The wrapper animates, the inner capsule keeps the
            // shadow — and the wrapper's blur passes through to the shadow
            // too, so the whole capsule blurs in as one piece.
            // -mt-dist-xs is the export's 2px negative gap: the capsule tucks
            // under the toast rather than sitting flush below it.
            <motion.div
              className="-mt-dist-xs"
              initial={extraInfoEnterState}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{
                ...EXTRA_INFO.transition,
                delay: EXTRA_INFO.delay,
                // A per-property override replaces the whole transition for
                // that property, so the delay has to be repeated here — it
                // isn't inherited from the parent object.
                opacity: {
                  duration: EXTRA_INFO.fade,
                  ease: STRONG_EASE_OUT,
                  delay: EXTRA_INFO.delay,
                },
              }}
            >
              <div className="flex items-center gap-dist-sm rounded-full bg-surface-4 px-pad-md py-pad-xs text-body-md text-text-bold drop-shadow-[0px_4px_16px_rgba(0,0,0,0.25)] [&_svg]:size-4">
                {extraInfo}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { Toast }
