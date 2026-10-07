"use client"

import * as React from "react"
import { SpinnerGap } from "@phosphor-icons/react"

import { withInlineNetworkError, type ActionError } from "@/lib/network-error"

// Matches Supabase's own minimum interval between emails to one address
// (Auth → Rate Limits). Resending sooner is refused server-side anyway, so
// counting down to it means the link is never offered while it can't work.
const RESEND_COOLDOWN_S = 60

function secondsLeft(sentAt: number) {
  const elapsed = Math.floor((Date.now() - sentAt) / 1000)
  return Math.max(0, RESEND_COOLDOWN_S - elapsed)
}

function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

interface ResendCodeProps {
  // When the current code went out — the countdown runs from here.
  sentAt: number
  resend: () => Promise<ActionError | { success: true }>
  onResent: (sentAt: number) => void
}

function ResendCode({ sentAt, resend, onResent }: ResendCodeProps) {
  const [remaining, setRemaining] = React.useState(() => secondsLeft(sentAt))
  const [isSending, setIsSending] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Derived from sentAt on every tick rather than decremented, so a
  // throttled background tab can't drift the countdown away from the clock.
  // Callers key this component on sentAt, so a resend remounts it with a
  // fresh countdown instead of this effect having to reset state itself.
  React.useEffect(() => {
    const interval = window.setInterval(() => {
      const next = secondsLeft(sentAt)
      setRemaining(next)
      if (next === 0) window.clearInterval(interval)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [sentAt])

  const handleResend = async () => {
    setIsSending(true)
    setErrorMessage(null)
    const result = await withInlineNetworkError(resend())
    setIsSending(false)
    if ("error" in result) {
      setErrorMessage(result.error)
      return
    }
    onResent(Date.now())
  }

  return (
    <div className="flex flex-col gap-dist-sm">
      {/* A flex row rather than inline text: inline, the link's spinner sat
          on the text baseline and dragged "Sending..." up off the line's
          middle. Centering the row keeps every state on one axis. */}
      <p className="flex flex-wrap items-center gap-x-dist-sm text-[length:var(--text-body-lg)] leading-[var(--text-body-lg--line-height)] tracking-[var(--text-body-lg--letter-spacing)] font-medium text-text-bold">
        Didn&apos;t get a code?
        {remaining > 0 ? (
          <span className="font-bold text-text-subtle tabular-nums">
            Resend in {formatCountdown(remaining)}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isSending}
            className="inline-flex cursor-pointer items-center gap-dist-xs font-bold text-flame-500 hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60"
          >
            {isSending ? (
              <>
                <SpinnerGap weight="bold" className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Resend code"
            )}
          </button>
        )}
      </p>
      {errorMessage ? (
        <p className="text-[length:var(--text-body-md)] leading-[var(--text-body-md--line-height)] font-medium text-text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}

export { ResendCode }
