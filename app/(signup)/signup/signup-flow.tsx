"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { AuthShell } from "@/components/shared/auth-shell"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { CreateAccountScreen } from "./create-account-screen"
import { VerifyEmailScreen } from "./verify-email-screen"
import { LoginScreen } from "./login-screen"
import { ForgotPasswordScreen } from "./forgot-password-screen"
import { ForgotPasswordVerifyScreen } from "./forgot-password-verify-screen"
import { ResetPasswordScreen } from "./reset-password-screen"

type AuthStep =
  | { name: "create-account" }
  | { name: "verify-email"; email: string }
  | { name: "login" }
  | { name: "forgot-password" }
  | { name: "forgot-password-verify" }
  | { name: "reset-password" }

// Create account and login are one persisted client-side view (not two page
// navigations) so the segmented control's tab indicator can actually slide
// between them. The control itself is rendered once, here, and shared by
// both screens — if each screen rendered its own SegmentedControl, switching
// steps would still remount it (a fresh component instance per screen), and
// the indicator would have nothing to animate from, same problem as a real
// page navigation. /login still works as a bookmarkable entry point via a
// server redirect into ?view=login.
function AuthFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = React.useState<AuthStep>(() => {
    const view = searchParams.get("view")
    if (view === "login") return { name: "login" }
    if (view === "forgot-password") return { name: "forgot-password" }
    return { name: "create-account" }
  })
  const [showResetSuccessToast, setShowResetSuccessToast] = React.useState(false)

  const goToLogin = () => {
    setStep({ name: "login" })
    router.replace("/signup?view=login", { scroll: false })
  }

  const goToCreateAccount = () => {
    setStep({ name: "create-account" })
    router.replace("/signup", { scroll: false })
  }

  const isTabStep = step.name === "create-account" || step.name === "login"

  return (
    <AuthShell>
      {showResetSuccessToast ? (
        <div className="absolute inset-x-0 top-pad-2xl flex justify-center">
          <Toast onDismiss={() => setShowResetSuccessToast(false)}>
            Password reset
          </Toast>
        </div>
      ) : null}

      {isTabStep ? (
        <div className="flex w-full max-w-sm flex-col items-start gap-dist-xl">
          <SegmentedControl
            value={step.name}
            onValueChange={(newValue) => {
              if (newValue === "login") goToLogin()
              else if (newValue === "create-account") goToCreateAccount()
            }}
            items={[
              { label: "Create account", value: "create-account" },
              { label: "Login", value: "login" },
            ]}
          />
          {/*
            Both screens stay mounted, stacked in the same grid cell, so the
            container's height is always the taller of the two — the inactive
            one is invisible/inert rather than unmounted. Otherwise create
            account (3 fields) vs login (2 fields) resolve to different
            heights, and AuthShell's vertical centering re-centers the whole
            block on every switch, dragging the segmented control up/down.
          */}
          <div className="grid w-full">
            <div
              className={cn(
                "col-start-1 row-start-1 flex flex-col items-start gap-dist-xl",
                step.name !== "create-account" && "invisible"
              )}
              inert={step.name !== "create-account"}
            >
              <CreateAccountScreen
                onContinue={(email) => setStep({ name: "verify-email", email })}
              />
            </div>
            <div
              className={cn(
                "col-start-1 row-start-1 flex flex-col items-start gap-dist-xl",
                step.name !== "login" && "invisible"
              )}
              inert={step.name !== "login"}
            >
              <LoginScreen
                onForgotPassword={() => setStep({ name: "forgot-password" })}
              />
            </div>
          </div>
        </div>
      ) : step.name === "verify-email" ? (
        <VerifyEmailScreen
          email={step.email}
          onBack={() => setStep({ name: "create-account" })}
        />
      ) : step.name === "forgot-password" ? (
        <ForgotPasswordScreen
          onBack={goToLogin}
          onContinue={() => setStep({ name: "forgot-password-verify" })}
        />
      ) : step.name === "forgot-password-verify" ? (
        <ForgotPasswordVerifyScreen
          onBack={() => setStep({ name: "forgot-password" })}
          onContinue={() => setStep({ name: "reset-password" })}
        />
      ) : (
        <ResetPasswordScreen
          onBack={() => setStep({ name: "forgot-password-verify" })}
          onContinue={() => {
            setShowResetSuccessToast(true)
            goToLogin()
          }}
        />
      )}
    </AuthShell>
  )
}

export { AuthFlow }
