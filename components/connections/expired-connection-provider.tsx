"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { WarningDiamond } from "@phosphor-icons/react"

import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import { isBlockedByExpiredLinkedIn } from "@/lib/connection-health"
import { startSectionNavigation } from "@/lib/section-navigation"
import type { PostPlatform } from "@/types/post"

const EXPIRED_CONNECTION_MESSAGE =
  "Your LinkedIn connection expired. Reconnect for your posts to go live."

const ExpiredConnectionContext = React.createContext<{
  hasExpiredLinkedIn: boolean
  connectionsHref: string
  showExpiredConnectionModal: () => void
  blockPostingWithExpiredConnection: (
    platform: PostPlatform,
    isTryout: boolean
  ) => boolean
} | null>(null)

// One project-shell owner for every expired-connection affordance. Keeping the
// dialog here means entry, scheduling, and publishing all open the same modal
// instead of maintaining subtly different copies on each screen.
export function ExpiredConnectionProvider({
  projectId,
  hasExpiredLinkedIn,
  children,
}: {
  projectId: string
  hasExpiredLinkedIn: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const connectionsHref = `/projects/${projectId}/connections`
  const [open, setOpen] = React.useState(hasExpiredLinkedIn)

  const showExpiredConnectionModal = React.useCallback(() => setOpen(true), [])
  const blockPostingWithExpiredConnection = React.useCallback(
    (platform: PostPlatform, isTryout: boolean) => {
      const blocked = isBlockedByExpiredLinkedIn(
        hasExpiredLinkedIn,
        platform,
        isTryout
      )
      if (blocked) setOpen(true)
      return blocked
    },
    [hasExpiredLinkedIn]
  )

  const goToConnections = () => {
    setOpen(false)
    startSectionNavigation(connectionsHref)
    router.push(connectionsHref)
  }

  return (
    <ExpiredConnectionContext.Provider
      value={{
        hasExpiredLinkedIn,
        connectionsHref,
        showExpiredConnectionModal,
        blockPostingWithExpiredConnection,
      }}
    >
      {children}
      <ConfirmationModal
        open={open}
        onOpenChange={setOpen}
        icon={
          <WarningDiamond weight="bold" className="size-12 text-icon-danger" />
        }
        title="Connection expired"
        description={EXPIRED_CONNECTION_MESSAGE}
        actionLabel="Go to connections"
        actionVariant="brand"
        onConfirm={goToConnections}
      />
    </ExpiredConnectionContext.Provider>
  )
}

export function useExpiredConnection() {
  const context = React.useContext(ExpiredConnectionContext)
  if (!context) {
    throw new Error(
      "useExpiredConnection must be used inside ExpiredConnectionProvider"
    )
  }
  return context
}
