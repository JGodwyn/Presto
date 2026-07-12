"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Envelope, Eye, EyeClosedIcon, LockKey, SpinnerGap } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import { GoogleIcon } from "@/components/shared/google-icon"
import { login } from "@/app/(auth)/login/actions"

const loginSchema = z.object({
  email: z.string().min(1, "This is required").email("Enter a valid email"),
  password: z.string().min(1, "This is required"),
})

type LoginValues = z.infer<typeof loginSchema>

interface LoginScreenProps {
  onForgotPassword: () => void
}

function LoginScreen({ onForgotPassword }: LoginScreenProps) {
  const [showPassword, setShowPassword] = React.useState(false)
  // RHF's isSubmitting ends when the handler resolves — but on success the
  // login action redirects, and the await resolves before the router has
  // fetched (in dev: compiled) the target page. Without this flag the button
  // snaps back to "Login" during that gap and the screen looks stalled. Kept
  // true on success on purpose: this screen unmounts when the redirect lands
  // (same pattern as verify-email-screen's manual isSubmitting).
  const [isRedirecting, setIsRedirecting] = React.useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const isLoggingIn = isSubmitting || isRedirecting

  const onSubmit = async (values: LoginValues) => {
    const result = await login(values)
    if (result && "error" in result) {
      setError("password", { message: result.error })
    } else {
      setIsRedirecting(true)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex w-full flex-col items-start gap-dist-xl"
    >
      <h1 className="text-heading-md font-display text-text-bold">LOGIN</h1>

      <div className="flex w-full flex-col gap-dist-lg">
        <PillInput
          type="email"
          placeholder="Email address"
          autoComplete="email"
          icon={<Envelope weight="bold" />}
          aria-invalid={!!errors.email}
          helperText={errors.email?.message}
          {...register("email")}
        />
        <PillInput
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          autoComplete="current-password"
          icon={<LockKey weight="bold" />}
          aria-invalid={!!errors.password}
          helperText={errors.password?.message}
          endAdornment={
            <button
              type="button"
              className="cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <EyeClosedIcon weight="bold" />
              ) : (
                <Eye weight="bold" />
              )}
            </button>
          }
          {...register("password")}
        />
      </div>

      <div className="flex w-full gap-dist-md">
        <Button
          type="submit"
          variant="brand"
          size="xl"
          className="flex-1"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <>
              <SpinnerGap weight="bold" className="animate-spin" />
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xl"
          className="w-pad-5xl px-0"
          aria-label="Continue with Google"
        >
          <GoogleIcon className="size-6" />
        </Button>
      </div>

      <p className="text-[length:var(--text-body-lg)] leading-[var(--text-body-lg--line-height)] tracking-[var(--text-body-lg--letter-spacing)] font-medium text-text-bold">
        Forgot password?{" "}
        <button
          type="button"
          onClick={onForgotPassword}
          className="cursor-pointer font-bold text-flame-500 hover:underline"
        >
          Reset it here
        </button>
      </p>
    </form>
  )
}

export { LoginScreen }
