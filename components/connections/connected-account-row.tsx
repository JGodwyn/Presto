"use client"

import Image from "next/image"
import { Timer } from "@phosphor-icons/react"

import {
  PlatformRow,
  ROW_CORNER_RADIUS,
} from "@/components/connections/platform-row"
import { Button } from "@/components/ui/button"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { formatExpiry } from "@/lib/format-date"
import type { ConnectedSocialAccount } from "@/types/social-account"

// The Figma "Social Connected" export: the same white PlatformRow, tucked into
// a green surface-success block that shows only along its bottom edge — 4px of
// gap plus the "Connected as …" caption plus 4px of padding. The white row is
// flush to the block's top and carries the same rad-lg, so their top corners
// coincide exactly and the green reads as something the row is sitting in.
//
// The expiry line is a sibling *below* that block, not part of it: it's about
// the token, not the account, and it greys out rather than joining the green.
function ConnectedAccountRow({
  account,
  label,
  now,
  onDisconnect,
}: {
  account: ConnectedSocialAccount
  label: string
  now: Date
  onDisconnect: () => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: ROW_CORNER_RADIUS,
  })

  return (
    <div className="flex flex-col gap-dist-md">
      <div
        ref={ref}
        style={style}
        className="flex flex-col gap-dist-sm rounded-rad-lg bg-surface-success pb-pad-xs"
      >
        <PlatformRow
          platform={account.platform}
          label={label}
          action={
            <Button variant="danger" size="sm" onClick={onDisconnect}>
              Disconnect
            </Button>
          }
        />

        <div className="flex items-center gap-dist-sm px-pad-md">
          {/* The same gradient avatar the navbar chip uses — a placeholder for
              LinkedIn's `picture` claim once the real flow supplies one. */}
          <Image
            src="/images/create-project/avatar.svg"
            alt=""
            width={16}
            height={16}
            className="shrink-0"
          />
          <span className="truncate text-body-md-bold text-text-inverse">
            Connected as {account.accountName}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-dist-sm px-pad-sm">
        <Timer weight="bold" className="size-5 shrink-0 text-icon-subtle" />
        <span className="text-body-md-bold text-text-subtle">
          {formatExpiry(new Date(account.expiresAt), now)}
        </span>
      </div>
    </div>
  )
}

export { ConnectedAccountRow }
