"use client"

import * as React from "react"
import { useDialKit } from "dialkit"
import { Bell, Spinner } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Toast } from "@/components/ui/toast"

// Dev/testing affordance, not part of the Figma Instructions design (same
// spirit as ReplayOnboardingButton on the dashboard): fires a toast on demand
// so the entrance can be tuned against the DialKit "Toast" panel without
// having to provoke a real save failure. Kept understated — outline, not
// brand-colored.
export function ToastPreviewButton() {
  const [open, setOpen] = React.useState(false)
  // Bumped on every click so the Toast remounts: AnimatePresence only replays
  // the entrance when its child is genuinely (re)inserted, so re-clicking
  // while one is still on screen would otherwise do nothing visible. A fresh
  // key is also what makes a dial tweak testable — change a value, click,
  // see it immediately.
  const [replayKey, setReplayKey] = React.useState(0)

  // A second panel, separate from the "Toast" panel that owns the motion
  // itself: this one is about *what* to render, so tuning the animation and
  // switching the thing being animated stay independent. Stable `id` for the
  // same reason as the Toast panel — see the comment there.
  const preview = useDialKit(
    "Toast preview",
    {
      variant: {
        type: "select",
        options: ["danger", "success", "info", "warning"],
        default: "danger",
      },
      direction: {
        type: "select",
        options: ["top", "bottom", "left", "right"],
        default: "top",
      },
      message: { type: "text", default: "Network disconnected" },
      withExtraInfo: true,
      extraInfo: { type: "text", default: "Trying to reconnect" },
      duration: [6000, 1000, 20000, 500],
    },
    { id: "toast-preview" }
  )

  return (
    <>
      {/* Same fixed top-center slot every other toast in the app uses. */}
      <div className="pointer-events-none fixed inset-x-0 top-pad-2xl z-50 flex justify-center">
        <Toast
          key={replayKey}
          open={open}
          onOpenChange={setOpen}
          variant={preview.variant as React.ComponentProps<typeof Toast>["variant"]}
          direction={
            preview.direction as React.ComponentProps<typeof Toast>["direction"]
          }
          duration={preview.duration}
          extraInfo={
            preview.withExtraInfo ? (
              <>
                <Spinner weight="bold" className="animate-spin" />
                {preview.extraInfo}
              </>
            ) : undefined
          }
        >
          {preview.message}
        </Toast>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setReplayKey((key) => key + 1)
          setOpen(true)
        }}
      >
        <Bell weight="bold" />
        Render toast
      </Button>
    </>
  )
}
