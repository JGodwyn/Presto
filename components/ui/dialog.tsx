"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma corner radius (app/globals.css --rad-lg) matched to a pixel number
// here because the squircle path math needs actual px, not a CSS var — see
// hooks/use-squircle-clip-path.ts.
const CONTENT_CORNER_RADIUS = 16
const CORNER_SMOOTHING = 1

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/25 backdrop-blur-[8px] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  popupClassName,
  children,
  showCloseButton = true,
  clipContent = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  // Sizing/position overrides for the Popup itself (e.g. a wider modal);
  // `className` styles the inner card div, which is the wrong layer for
  // width — the Popup owns it.
  popupClassName?: string
  // Skips this wrapper's own squircle clip-path — for content that already
  // renders its own complete card (e.g. Calendar's showActionBar mode via
  // GeneratedPostCard's "Add to calendar" dialog). A clip-path on this
  // wrapper clips everything inside it to that exact shape, including
  // anything a child needs to bleed past its own edges — the child's own
  // drop shadow ends up hard-cut at almost the same boundary it's supposed
  // to soften, reading as an abrupt clip rather than a shadow. Leave this on
  // (default) for ordinary modals, where this wrapper *is* the visible card
  // and its own clip-path is exactly what gives it squircle corners.
  clipContent?: boolean
}) {
  // The squircle clip-path has to live on a plain div we own, not on
  // Popup itself — Popup writes its own `style` attribute directly to the
  // DOM (e.g. `--nested-dialogs`) outside React's render, which clobbers
  // whatever we pass in via the `style` prop.
  const { ref: squircleRef, style: squircleStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: CONTENT_CORNER_RADIUS,
      cornerSmoothing: CORNER_SMOOTHING,
    })

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 transition duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          popupClassName
        )}
        {...props}
      >
        <div
          ref={clipContent ? squircleRef : undefined}
          className={cn(
            // rounded-rad-lg is the fallback shape until the squircle
            // clip-path is measured on mount (see use-squircle-clip-path.ts).
            "relative flex flex-col gap-dist-lg rounded-rad-lg bg-surface-4 px-pad-lg py-pad-xl",
            className
          )}
          style={clipContent ? squircleStyle : undefined}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="danger"
                  className="absolute top-pad-sm right-pad-sm"
                  size="icon-sm"
                />
              }
            >
              <X weight="bold" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </div>
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-heading-sm font-display text-text-bold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-body-md text-text-subtle", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
}
