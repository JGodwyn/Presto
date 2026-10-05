"use client"

import * as React from "react"
import { ArrowLeft, SpinnerGap, Warning } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import {
  requestPasswordReset,
  verifyRecoveryOtp,
} from "@/app/(auth)/forgot-password/actions"
import { otpErrorMessage } from "@/lib/supabase/otp-error"
import { reportNetworkIssue, withNetworkStatus } from "@/lib/network-status"
import { ResendCode } from "./resend-code"

const CODE_LENGTH = 6

interface ForgotPasswordVerifyScreenProps {
  email: string
  sentAt: number
  onBack: () => void
  onContinue: () => void
  onResent: (sentAt: number) => void
}

function ForgotPasswordVerifyScreen({
  email,
  sentAt,
  onBack,
  onContinue,
  onResent,
}: ForgotPasswordVerifyScreenProps) {
  const [code, setCode] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleCodeChange = (value: string) => {
    setCode(value)
    if (errorMessage) setErrorMessage(null)
  }

  const handleResent = (resentAt: number) => {
    // The old code is dead once a new one is issued, so whatever was typed
    // (and any error it earned) goes with it.
    setCode("")
    setErrorMessage(null)
    onResent(resentAt)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    const result = await withNetworkStatus(verifyRecoveryOtp({ email, token: code }))
    if (result === null) {
      setIsSubmitting(false)
      return
    }
    setIsSubmitting(false)
    if ("error" in result) {
      // Never blame the code for a request that never landed.
      if (result.network) {
        reportNetworkIssue()
        return
      }
      setErrorMessage(otpErrorMessage(sentAt))
      return
    }
    onContinue()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col items-start gap-dist-xl"
    >
      <Button
        type="button"
        variant="brand"
        size="icon-md"
        aria-label="Back"
        onClick={onBack}
      >
        <ArrowLeft weight="bold" />
      </Button>

      <div className="flex flex-col gap-dist-lg">
        <h1 className="text-heading-md font-display text-text-bold">
          FORGOT PASSWORD
        </h1>
        <p className="text-[length:var(--text-body-lg)] leading-[var(--text-body-lg--line-height)] tracking-[var(--text-body-lg--letter-spacing)] font-medium text-text-bold">
          Enter the code sent to your email address to continue resetting
          your password.
        </p>
      </div>

      <div className="flex w-full flex-col gap-dist-sm">
        <InputOTP
          maxLength={CODE_LENGTH}
          value={code}
          onChange={handleCodeChange}
          containerClassName="w-full"
        >
          <InputOTPGroup>
            {Array.from({ length: CODE_LENGTH }, (_, index) => (
              <InputOTPSlot key={index} index={index} error={!!errorMessage} />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {errorMessage ? (
          <div className="flex w-full items-start gap-dist-md transition-[opacity,translate] duration-150 ease-out starting:-translate-y-0.5 starting:opacity-0">
            <span className="flex shrink-0 items-center justify-center text-icon-danger [&_svg]:size-5">
              <Warning weight="bold" />
            </span>
            <p className="text-[length:var(--text-body-lg-bold)] leading-[var(--text-body-lg-bold--line-height)] tracking-[var(--text-body-lg-bold--letter-spacing)] font-bold text-text-danger">
              {errorMessage}
            </p>
          </div>
        ) : null}
      </div>

      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="w-full"
        disabled={code.length < CODE_LENGTH || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <SpinnerGap weight="bold" className="animate-spin" />
            Verifying...
          </>
        ) : (
          "Continue"
        )}
      </Button>

      <ResendCode
        key={sentAt}
        sentAt={sentAt}
        resend={() => requestPasswordReset({ email })}
        onResent={handleResent}
      />
    </form>
  )
}

export { ForgotPasswordVerifyScreen }
