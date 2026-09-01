"use client"

import * as React from "react"
import Image from "next/image"
import { SpinnerGap, Timer, WarningDiamond } from "@phosphor-icons/react"

import {
  PlatformRow,
  ROW_CORNER_RADIUS,
} from "@/components/connections/platform-row"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import {
  connectionStatus,
  formatExpiry,
  isConnectionDead,
} from "@/lib/format-date"
import { cn } from "@/lib/utils"
import type { ConnectedSocialAccount } from "@/types/social-account"

const GRADIENT_AVATAR = "/images/create-project/avatar.svg"

// rad-md, for the "Renew now" chip's squircle path.
const RENEW_CHIP_CORNER_RADIUS = 8

// The Figma "Connection-ConnectedState{Connected,ExpiringSoon,Expired}"
// exports — one row with three treatments, driven by how much of the 60-day
// token is left, plus a fourth the exports don't draw (see `revoked` below):
//
//   active    green block, "Connected as …", Disconnect, grey countdown
//   expiring  same block, but the countdown turns text-warning and grows a
//             "Renew now" chip (≤ 7 days — see EXPIRY_WARNING_DAYS)
//   expired   block turns surface-danger and reads "Connection expired" over a
//             WarningDiamond; the action becomes a success-green "Reconnect",
//             and the countdown goes away entirely (the strip has said it)
//   revoked   the expired treatment exactly, reading "Connection revoked" —
//             no Figma frame draws this, because it isn't a date at all: the
//             member removed Presto's access at LinkedIn's end, so a token
//             with weeks left on it simply stopped working. Reusing the dead
//             treatment is deliberate: the cause differs, the remedy doesn't
//
// The white PlatformRow is flush to the block's top and shares its rad-lg in
// every state, so their top corners coincide and the colour reads as something
// the row is sitting in.
//
// **Why the warning state exists at all**: renewing while the current token is
// still alive is a silent redirect — LinkedIn skips the consent screen — but
// only until it lapses. So the amber window is the difference between one
// click and a full re-authorisation, which is exactly what the tooltip says.
function ConnectedAccountRow({
  account,
  label,
  now,
  pending,
  onDisconnect,
  onReconnect,
}: {
  account: ConnectedSocialAccount
  label: string
  now: Date
  pending: boolean
  onDisconnect: () => void
  onReconnect: () => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: ROW_CORNER_RADIUS,
  })
  const [avatarFailed, setAvatarFailed] = React.useState(false)

  // Two ways to be dead, one treatment. The date alone can't see a revocation
  // — that's what account.status carries (see verifyLinkedInToken).
  const status = connectionStatus(
    new Date(account.expiresAt),
    account.status === "revoked",
    now
  )
  const isDead = isConnectionDead(status)

  return (
    <div className="flex flex-col gap-dist-md">
      <div
        ref={ref}
        style={style}
        className={cn(
          "flex flex-col gap-dist-sm rounded-rad-lg pb-pad-xs",
          isDead ? "bg-surface-danger" : "bg-surface-success"
        )}
      >
        <PlatformRow
          platform={account.platform}
          label={label}
          action={
            isDead ? (
              <Button
                variant="success"
                size="sm"
                disabled={pending}
                onClick={onReconnect}
                // The label is replaced by a spinner while the redirect is in
                // flight, so the name has to come from somewhere that survives
                // it (same reason the Connect button carries one).
                aria-label={`Reconnect ${label}`}
              >
                {pending ? (
                  <SpinnerGap weight="bold" className="animate-spin" />
                ) : (
                  "Reconnect"
                )}
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={onDisconnect}>
                Disconnect
              </Button>
            )
          }
        />

        <div className="flex items-center gap-dist-sm px-pad-md">
          {isDead ? (
            <WarningDiamond
              weight="bold"
              className="size-4 shrink-0 text-icon-inverse"
            />
          ) : (
            /* LinkedIn's `picture` claim when the member has one, falling back
               to the same gradient avatar the navbar chip uses — the export
               draws the gradient, and a photoless account still needs a mark.
               rounded-full, not squircled: a 16px circle has no straight edge
               for corner smoothing (same call as toast.tsx).

               **The fallback also covers a URL that has gone stale.** LinkedIn
               serves profile photos from time-limited, dynamically-keyed CDN
               URLs and its own media docs say to re-fetch them periodically —
               but this one is stored for as long as the connection lives (up
               to 60 days), so it can expire well before the row does. Rather
               than show a broken image, a failed load drops to the gradient;
               the next connect refreshes the URL. */
            <Image
              src={
                avatarFailed || !account.avatarUrl
                  ? GRADIENT_AVATAR
                  : account.avatarUrl
              }
              alt=""
              width={16}
              height={16}
              className="size-4 shrink-0 rounded-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          )}
          <span className="truncate text-body-md-bold text-text-inverse">
            {status === "revoked"
              ? "Connection revoked"
              : status === "expired"
                ? "Connection expired"
                : `Connected as ${account.accountName}`}
          </span>
        </div>
      </div>

      {/* Dropped once dead: the red strip above already says so, and a
          countdown underneath it would be reporting either a deadline that has
          already passed or — for a revoked connection — days remaining on a
          token that stopped working regardless. */}
      {!isDead && (
        <div className="flex items-center justify-center gap-dist-md px-pad-sm">
          <div className="flex items-center gap-dist-sm">
            <Timer
              weight="bold"
              className={cn(
                "size-5 shrink-0",
                status === "expiring" ? "text-icon-warning" : "text-icon-subtle"
              )}
            />
            <span
              className={cn(
                "text-body-lg-bold",
                status === "expiring" ? "text-text-warning" : "text-text-subtle"
              )}
            >
              {formatExpiry(new Date(account.expiresAt), now)}
            </span>
          </div>

          {status === "expiring" && (
            <RenewChip pending={pending} onRenew={onReconnect} />
          )}
        </div>
      )}
    </div>
  )
}

// The export's "Renew now" — a surface-2 chip beside the countdown rather than
// a Button variant: it's rad-md at pad-sm/pad-2xs, which no Button size
// renders, and it deliberately reads quieter than the row's own action. Its
// tooltip is the whole point of the state, so it carries the reason rather
// than repeating the label.
function RenewChip({
  pending,
  onRenew,
}: {
  pending: boolean
  onRenew: () => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: RENEW_CHIP_CORNER_RADIUS,
  })

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            ref={ref}
            style={style}
            type="button"
            disabled={pending}
            onClick={onRenew}
            aria-label="Renew connection"
            className="flex shrink-0 items-center gap-dist-sm rounded-rad-md bg-surface-2 px-pad-sm py-pad-2xs text-body-lg-bold text-text-bold transition-[scale] duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
          >
            {pending ? (
              <SpinnerGap weight="bold" className="size-5 animate-spin" />
            ) : (
              "Renew now"
            )}
          </button>
        }
      />
      <TooltipContent>
        Renew now to avoid having to authorize all over again
      </TooltipContent>
    </Tooltip>
  )
}

export { ConnectedAccountRow }
