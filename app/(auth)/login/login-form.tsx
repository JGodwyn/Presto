"use client"

// Not currently wired into any route. Preserved for the task that reconnects
// Supabase login to the new /login screen at login-screen.tsx — this already
// has real signInWithPassword() wiring via ./actions, just not the Figma UI.

import { useState, useTransition } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

import { login } from "./actions"

const schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = (values: FormValues) => {
    setFormError(null)
    startTransition(async () => {
      const result = await login(values)
      if (result?.error) {
        setFormError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        {formError && <FieldError>{formError}</FieldError>}
        <Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign in"}
          </Button>
        </Field>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="underline underline-offset-4">
            Forgot your password?
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
