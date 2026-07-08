"use client"

import * as React from "react"
import { ArrowLeft, Warning } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

const CODE_LENGTH = 5

// Temporary test-only trigger for the error state, since Supabase OTP
// verification isn't wired up yet — remove once the real check lands.
const SIMULATED_INCORRECT_CODE = "12345"

interface ForgotPasswordVerifyScreenProps {
  onBack: () => void
  onContinue: () => void
}

function ForgotPasswordVerifyScreen({
  onBack,
  onContinue,
}: ForgotPasswordVerifyScreenProps) {
  const [code, setCode] = React.useState("")
  const [hasError, setHasError] = React.useState(false)

  const handleCodeChange = (value: string) => {
    setCode(value)
    if (hasError) setHasError(false)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    // Supabase OTP verification is a separate follow-up task; this is UI-only.
    if (code === SIMULATED_INCORRECT_CODE) {
      setHasError(true)
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
              <InputOTPSlot key={index} index={index} error={hasError} />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {hasError ? (
          <div className="flex w-full items-start gap-dist-md transition-[opacity,transform] duration-150 ease-out starting:-translate-y-0.5 starting:opacity-0">
            <span className="flex shrink-0 items-center justify-center text-icon-danger [&_svg]:size-5">
              <Warning weight="bold" />
            </span>
            <p className="text-[length:var(--text-body-lg-bold)] leading-[var(--text-body-lg-bold--line-height)] tracking-[var(--text-body-lg-bold--letter-spacing)] font-bold text-text-danger">
              This code is incorrect
            </p>
          </div>
        ) : null}
      </div>

      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="w-full"
        disabled={code.length < CODE_LENGTH}
      >
        Continue
      </Button>
    </form>
  )
}

export { ForgotPasswordVerifyScreen }
