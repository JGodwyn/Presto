"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Envelope,
  Eye,
  EyeClosedIcon,
  Lock,
  SpinnerGap,
  User,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import { GoogleIcon } from "@/components/shared/google-icon"
import { signup } from "@/app/(auth)/signup/actions"

const createAccountSchema = z.object({
  email: z.string().min(1, "This is required").email("Enter a valid email"),
  name: z.string().min(1, "This is required"),
  password: z
    .string()
    .min(1, "This is required")
    .min(8, "Password must be at least 8 characters"),
})

type CreateAccountValues = z.infer<typeof createAccountSchema>

interface CreateAccountScreenProps {
  onContinue: (email: string) => void
}

function CreateAccountScreen({ onContinue }: CreateAccountScreenProps) {
  const [showPassword, setShowPassword] = React.useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateAccountValues>({ resolver: zodResolver(createAccountSchema) })

  const onSubmit = async (values: CreateAccountValues) => {
    const result = await signup(values)
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
      className="flex w-full flex-col items-start gap-dist-xl"
    >
      <h1 className="text-heading-md font-display text-text-bold">
        Create Account
      </h1>

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
          type="text"
          placeholder="Your name"
          autoComplete="name"
          icon={<User weight="bold" />}
          aria-invalid={!!errors.name}
          helperText={errors.name?.message}
          {...register("name")}
        />
        <PillInput
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          autoComplete="new-password"
          icon={<Lock weight="bold" />}
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
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <SpinnerGap weight="bold" className="animate-spin" />
              Creating account...
            </>
          ) : (
            "Create Account"
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
    </form>
  )
}

export { CreateAccountScreen }
