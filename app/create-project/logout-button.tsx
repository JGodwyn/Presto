"use client"

import { useFormStatus } from "react-dom"
import { Power, SpinnerGap } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

function LogoutButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant="brand-secondary"
      size="xl"
      disabled={pending}
    >
      {pending ? (
        <SpinnerGap weight="bold" className="animate-spin" />
      ) : (
        <Power weight="bold" />
      )}
      Log out
    </Button>
  )
}

export { LogoutButton }
