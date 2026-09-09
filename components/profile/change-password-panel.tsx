"use client"

import * as React from "react"
import { Eye, EyeClosed, LockKey, SpinnerGap } from "@phosphor-icons/react"

import {
  changePassword,
  setPassword,
} from "@/app/projects/[projectId]/profile/account-actions"
import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import { Toast } from "@/components/ui/toast"
import { ToastSlot } from "@/components/shared/toast-slot"
import { withNetworkStatus } from "@/lib/network-status"

// The reveal toggle the export draws at the end of each field. Its own
// component so the two fields don't share one flag — revealing the current
// password shouldn't also reveal the new one.
function RevealButton({
  shown,
  onToggle,
  label,
}: {
  shown: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${shown ? "Hide" : "Show"} ${label}`}
      className="flex cursor-pointer items-center justify-center text-icon-subtle transition-colors duration-150 ease hover:text-icon-bold"
    >
      {shown ? <EyeClosed weight="bold" /> : <Eye weight="bold" />}
    </button>
  )
}

// Profile's "Change password" panel (Figma "profilescreenexpanded"): the two
// fields and the brand button, sized to the card's 292px inner width.
//
// Unlike the rest of this app there's no blur-save here — a password change is
// exactly the kind of thing that should take a deliberate submit — so the
// button owns the pending state.
export function ChangePasswordPanel({
  projectId,
  hasPassword,
  onSuccess,
}: {
  projectId?: string
  hasPassword: boolean
  // Lets the disclosure collapse itself once the password is changed — the
  // panel has nothing left to say, and leaving a form of cleared fields open
  // reads as though something is still pending.
  onSuccess?: () => void
}) {
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNext, setShowNext] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  // Held with the field it belongs to, so a wrong *current* password doesn't
  // also mark the new one as invalid. `null` field = form-level; it falls to
  // the new-password slot, which is the last thing the user touched.
  const [error, setError] = React.useState<{
    message: string
    field: "current" | "new"
  } | null>(null)
  // Split from the toast's own open/close lifecycle so the message doesn't
  // blank out mid-exit-animation — same shape as ai-models-card.tsx.
  const [toastOpen, setToastOpen] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState("")

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return

    setError(null)
    setPending(true)
    const result = await withNetworkStatus(
      hasPassword
        ? changePassword({ currentPassword: current, newPassword: next })
        : setPassword({ newPassword: next })
    )
    setPending(false)

    // null = never reached the server; the disconnected toast covers it.
    if (result === null) return
    if ("error" in result) {
      // A network failure isn't the fault of anything they typed, and the
      // offline toast already says so — same rule the auth screens follow.
      if (!result.network) {
        setError({ message: result.error, field: result.field ?? "new" })
      }
      return
    }

    setCurrent("")
    setNext("")
    setShowCurrent(false)
    setShowNext(false)
    setToastMessage(hasPassword ? "Password changed" : "Password added")
    setToastOpen(true)
    // Toast first, then collapse: the confirmation is what the user is
    // waiting for, and it lives outside this subtree (see ToastSlot), so it
    // stays on screen while the panel folds away underneath it.
    onSuccess?.()
  }

  const canSubmit = (!hasPassword || current.length > 0) && next.length > 0 && !pending

  return (
    <>
      {/* Portalled out of this card: the card carries a squircle clip-path,
          which would otherwise both position and crop this fixed toast to the
          card itself — see components/shared/toast-slot.tsx. */}
      <ToastSlot>
        <Toast
          open={toastOpen}
          onOpenChange={setToastOpen}
          variant="success"
          direction="top"
          // No tick: the message is already only two words, and the panel
          // folding away behind it says "done" more clearly than an icon can.
          showIcon={false}
        >
          {toastMessage}
        </Toast>
      </ToastSlot>

      <form
        onSubmit={submit}
        // projectId isn't sent to the action — a password belongs to the
        // person, not a project — but the form is keyed to it so switching
        // projects can't leave a half-typed password behind.
        key={projectId}
        className="flex flex-col gap-dist-md"
      >
        {hasPassword ? (
          <PillInput
            type={showCurrent ? "text" : "password"}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            aria-label="Current password"
            aria-invalid={error?.field === "current" ? true : undefined}
            helperText={error?.field === "current" ? error.message : undefined}
            icon={<LockKey weight="bold" />}
            endAdornment={
              <RevealButton
                shown={showCurrent}
                onToggle={() => setShowCurrent((value) => !value)}
                label="current password"
              />
            }
          />
        ) : null}

        <PillInput
          type={showNext ? "text" : "password"}
          value={next}
          onChange={(event) => setNext(event.target.value)}
          placeholder="New password"
          autoComplete="new-password"
          aria-label="New password"
          aria-invalid={error?.field === "new" ? true : undefined}
          helperText={error?.field === "new" ? error.message : undefined}
          icon={<LockKey weight="bold" />}
          endAdornment={
            <RevealButton
              shown={showNext}
              onToggle={() => setShowNext((value) => !value)}
              label="new password"
            />
          }
        />

        <Button
          type="submit"
          variant="brand"
          size="xl"
          disabled={!canSubmit}
          className="w-full"
        >
          {pending ? (
            <>
              <SpinnerGap weight="bold" className="animate-spin" />
              {hasPassword ? "Changing…" : "Setting…"}
            </>
          ) : (
            hasPassword ? "Change password" : "Set password"
          )}
        </Button>
      </form>
    </>
  )
}
