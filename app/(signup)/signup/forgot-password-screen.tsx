"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ArrowLeft, Envelope } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"

// Client-side validation only for now — Supabase wiring is a separate
// follow-up task. Deliberately no "email doesn't exist" error state here
// (Figma doesn't show one either) — password-reset flows conventionally
// don't reveal whether an email is registered.
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
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = (values: ForgotPasswordValues) => {
    // Supabase wiring is a separate follow-up task; this is validation-only.
    // Treated as "reset code sent" for now.
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

      <Button type="submit" variant="brand" size="xl" className="w-full">
        Send
      </Button>
    </form>
  )
}

export { ForgotPasswordScreen }
