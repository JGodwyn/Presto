"use client"

import * as React from "react"
import { useDialKit } from "dialkit"
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

// DialKit's transition control resolves to one of these two shapes depending
// on which mode the panel is in (easing / simple spring / advanced spring).
type DialTransition =
  | {
    type: "spring"
    bounce?: number
    visualDuration?: number
    stiffness?: number
    damping?: number
    mass?: number
  }
  | { type: "easing"; duration: number; ease: [number, number, number, number] }

// Motion has no "easing" transition type — an easing config is just a tween
// described by a duration plus a cubic-bezier array, so `type` is dropped
// rather than forwarded. Springs pass through as-is, minus any handle the
// panel left undefined (Motion treats an explicit `undefined` as a value,
// not as "use your default").
function toMotionTransition(transition: DialTransition): Transition {
  if (transition.type === "easing") {
    return { duration: transition.duration, ease: transition.ease }
  }
  return {
    type: "spring",
    ...Object.fromEntries(
      Object.entries(transition).filter(
        ([key, value]) => key !== "type" && value !== undefined
      )
    ),
  }
}

interface ToastProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant?: ToastVariant
  direction?: ToastDirection
  duration?: number
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

  // Live-tunable via the DialKit panel (top-right, dev only) rather than
  // hand-editing values and reloading — same approach as useShake.
  // The explicit `id` is load-bearing: DialKit's default panel id is
  // `${name}-${useId()}`, i.e. one panel per *component instance*, so without
  // it every mounted Toast stacks up another identical "Toast" panel (the
  // Instructions page alone has four). A stable id collapses them into one
  // shared set of controls — which is also the intent, since the entrance is
  // meant to be uniform across every toast in the app. It additionally opts
  // the panel into DialKit's `retainOnUnmount`, so the controls stay
  // available when no toast happens to be on screen.
  // `transition` is DialKit's transition control: the panel can switch it
  // between an easing curve (duration + editable cubic-bezier) and a spring
  // (simple bounce/visualDuration, or advanced stiffness/damping/mass), which
  // is where the overshoot comes from — a spring settles past its target and
  // eases back on its own, no keyframe needed.
  const dial = useDialKit(
    "Toast",
    {
      // Defaults below are the values dialled in on the panel and handed back
      // to be made permanent — not theoretical starting points.
      enter: {
        slide: [15, 0, 80, 1],
        scale: [0.8, 0.5, 1, 0.01],
        blur: [2, 0, 12, 0.5],
        // Opacity is kept off the spring: a bouncing fade overshoots past 1
        // (clamped, so it just snaps opaque early) and reads as a flicker.
        fade: [0.15, 0.05, 1, 0.01],
        // bounce 0.6 is well past STANDARDS.md's "keep it 0.1-0.3" guidance
        // — a deliberate call, since a pronounced pop is the point here. At
        // a 15px slide it carries ~3.8px past the resting position and peaks
        // at scale 1.05 (~164ms in) before easing back. visualDuration is
        // time-to-target rather than total settle, so the motion reads as
        // 250ms even though the tail runs on to ~480ms.
        transition: { type: "spring", bounce: 0.6, visualDuration: 0.25 },
      },
      exit: {
        slide: [16, 0, 80, 1],
        scale: [0.7, 0.5, 1.2, 0.01],
        blur: [5, 0, 12, 0.5],
        // No spring on the way out — overshoot on an element that's leaving
        // draws the eye back to something the user is done with.
        transition: { type: "easing", duration: 0.2, ease: STRONG_EASE_OUT },
      },
    },
    { id: "toast" }
  )

  React.useEffect(() => {
    if (!open) return
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
      scale: dial.enter.scale,
      filter: `blur(${dial.enter.blur}px)`,
      ...offset(dial.enter.slide),
    }
  const exitState = prefersReducedMotion
    ? { opacity: 0 }
    : {
      opacity: 0,
      scale: dial.exit.scale,
      filter: `blur(${dial.exit.blur}px)`,
      ...offset(dial.exit.slide),
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
          exit={{
            ...exitState,
            transition: toMotionTransition(dial.exit.transition),
          }}
          transition={{
            ...toMotionTransition(dial.enter.transition),
            opacity: { duration: dial.enter.fade, ease: STRONG_EASE_OUT },
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
                {icon ?? <VariantIcon weight="bold" />}
              </span>
            )}
            <p className="text-[length:var(--text-title-lg)] leading-[var(--text-title-lg--line-height)] tracking-[var(--text-title-lg--letter-spacing)] font-display font-bold text-text-inverse uppercase">
              {children}
            </p>
          </div>
          {extraInfo && (
            // -mt-dist-xs is the export's 2px negative gap: the capsule tucks
            // under the toast rather than sitting flush below it.
            <div className="-mt-dist-xs flex items-center gap-dist-sm rounded-full bg-surface-4 px-pad-md py-pad-xs text-body-md text-text-bold drop-shadow-[0px_4px_16px_rgba(0,0,0,0.25)] [&_svg]:size-4">
              {extraInfo}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { Toast }
