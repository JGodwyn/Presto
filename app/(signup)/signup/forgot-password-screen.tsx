"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ArrowLeft, Envelope } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import { requestPasswordReset } from "@/app/(auth)/forgot-password/actions"

// Deliberately no "email doesn't exist" error state here (Figma doesn't
// show one either) — password-reset flows conventionally don't reveal
// whether an email is registered, and Supabase's resetPasswordForEmail()
// already returns success regardless. Errors surfaced below are things
// like rate limiting, not registration status.
const forgotPasswordSchema = z.object({
  email: z.string().min(1, "This is required").email("Enter a valid email"),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

interface ForgotPasswordScreenProps {
  onBack: () => void
  onContinue: (email: string) => void
}

function ForgotPasswordScreen({ onBack, onContinue }: ForgotPasswordScreenProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (values: ForgotPasswordValues) => {
    const result = await requestPasswordReset({ email: values.email })
    if ("error" in result) {
      setError("email", { message: result.error })
      return
    }
    onContinue(values.email)
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

      <div className="flex flex-col gap-dist-lg">
        <h1 className="text-heading-md font-display text-text-bold">
          FORGOT PASSWORD
        </h1>
        <p className="text-[length:var(--text-body-lg)] leading-[var(--text-body-lg--line-height)] tracking-[var(--text-body-lg--letter-spacing)] font-medium text-text-bold">
          Enter the email associated with your account and we&rsquo;ll send a
          code to reset your password.
        </p>
      </div>

      <PillInput
        type="email"
        placeholder="Email address"
        autoComplete="email"
        icon={<Envelope weight="bold" />}
        aria-invalid={!!errors.email}
        helperText={errors.email?.message}
        {...register("email")}
      />

      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="w-full"
        disabled={isSubmitting}
      >
        Send
      </Button>
    </form>
  )
}

export { ForgotPasswordScreen }
