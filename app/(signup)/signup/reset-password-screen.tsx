"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ArrowLeft, Eye, EyeClosedIcon, LockKey } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"

// Client-side validation only for now — Supabase wiring is a separate
// follow-up task.
const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, "This is required")
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "This is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

interface ResetPasswordScreenProps {
  onBack: () => void
  onContinue: () => void
}

function ResetPasswordScreen({ onBack, onContinue }: ResetPasswordScreenProps) {
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = () => {
    // Supabase wiring is a separate follow-up task; this is validation-only.
    onContinue()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
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

      <h1 className="text-heading-md font-display text-text-bold">
        reset PASSWORD
      </h1>

      <div className="flex w-full flex-col gap-dist-lg">
        <PillInput
          type={showPassword ? "text" : "password"}
          label="Enter your new password here"
          placeholder="Password"
          autoComplete="new-password"
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
        <PillInput
          type={showConfirmPassword ? "text" : "password"}
          label="Retype new password"
          placeholder="Password"
          autoComplete="new-password"
          icon={<LockKey weight="bold" />}
          aria-invalid={!!errors.confirmPassword}
          helperText={errors.confirmPassword?.message}
          endAdornment={
            <button
              type="button"
              className="cursor-pointer"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              aria-pressed={showConfirmPassword}
              onClick={() => setShowConfirmPassword((v) => !v)}
            >
              {showConfirmPassword ? (
                <EyeClosedIcon weight="bold" />
              ) : (
                <Eye weight="bold" />
              )}
            </button>
          }
          {...register("confirmPassword")}
        />
      </div>

      <Button type="submit" variant="brand" size="xl" className="w-full">
        Reset password
      </Button>
    </form>
  )
}

export { ResetPasswordScreen }
