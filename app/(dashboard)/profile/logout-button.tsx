"use client"

import { useFormStatus } from "react-dom"
import { SpinnerGap } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

function LogoutButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? (
        <>
          <SpinnerGap weight="bold" className="animate-spin" />
          Logging out...
        </>
      ) : (
        "Log out"
      )}
    </Button>
  )
}

export { LogoutButton }
