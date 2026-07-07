"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"

import { requestPasswordReset } from "./actions"

const schema = z.object({
  email: z.string().email("Enter a valid email."),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = (values: FormValues) => {
    setFormError(null)
    startTransition(async () => {
      const result = await requestPasswordReset(values)
      if ("error" in result) {
        setFormError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  if (success) {
    return (
      <p className="text-sm text-muted-foreground">
        If an account exists for that email, a reset link is on its way.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>
        {formError && <FieldError>{formError}</FieldError>}
        <Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sending..." : "Send reset link"}
          </Button>
        </Field>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4">
            Back to login
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
