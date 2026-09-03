"use client"

import * as React from "react"
import { SpinnerGap } from "@phosphor-icons/react"

import { Button, type buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import type { VariantProps } from "class-variance-authority"

// The app's default confirmation-modal layout, from the Figma
// "DefaultConfirmationModal" export (design-sync/defaultconfirmationmodal):
// an icon, a heading, a description, and a single full-width action button —
// no separate Cancel button. DialogContent's own default corner-X close
// button (already danger/icon-sm, top-right) is the dismiss/cancel action,
// so this component doesn't add a second one. DialogContent's card chrome
// (320px, surface-4, rad-lg, pad-lg/pad-xl, gap-dist-lg between children)
// already matches the export exactly, so this is mostly composition, not new
// styling — DialogTitle's default (heading-sm/font-display/text-bold) also
// matches as-is; only centering and DialogDescription's size/color need
// overriding (the export's body copy is body-lg/text-bold, not
// DialogDescription's usual smaller/subtler default).
export function ConfirmationModal({
  open,
  onOpenChange,
  icon,
  title,
  description,
  actionLabel,
  onConfirm,
  isPending = false,
  actionVariant = "danger",
  secondaryAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Optional: some dialogs read better without one.
  icon?: React.ReactNode
  title: string
  description: string
  actionLabel: string
  onConfirm: () => void
  isPending?: boolean
  actionVariant?: VariantProps<typeof buttonVariants>["variant"]
  // An optional second way out, under the main action. The Figma export draws
  // only one button — this is an addition, for the case where refusing
  // something leaves the user with a real alternative worth offering by name
  // rather than a bare dismiss. `brand-secondary` keeps it visibly subordinate
  // to the primary action; closing the dialog (the corner X) still means
  // "neither", so this must never be the only way to decline.
  secondaryAction?: { label: string; onClick: () => void }
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* items-center: DialogContent's base layout is a plain flex-col with
          no cross-axis alignment of its own (every other dialog in the app
          left-aligns), but this layout centers everything. */}
      <DialogContent className="items-center">
        {icon}
        <DialogTitle className="text-center">{title}</DialogTitle>
        <DialogDescription className="text-center text-body-lg text-text-bold">
          {description}
        </DialogDescription>
      {/* The actions are their own stack so they sit dist-md apart, tighter
          than DialogContent's dist-lg rhythm between the icon, title and
          copy — two buttons offering alternatives read as one control group,
          not as two more sections of the dialog. The wrapper is w-full so the
          buttons keep their full-width shape inside the centered column. */}
        <div className="flex w-full flex-col gap-dist-md">
          <Button
            variant={actionVariant}
            size="xl"
            className="w-full"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? (
              <SpinnerGap weight="bold" className="animate-spin" />
            ) : (
              actionLabel
            )}
          </Button>
          {secondaryAction && (
            <Button
              variant="brand-secondary"
              size="xl"
              className="w-full"
              disabled={isPending}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
