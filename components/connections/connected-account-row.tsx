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
import { isGrantStale } from "@/lib/social-scopes"
import { cn } from "@/lib/utils"
import type { ConnectedSocialAccount } from "@/types/social-account"

const GRADIENT_AVATAR = "/images/create-project/avatar.svg"

// rad-md, for the countdown chip's squircle path.
const RECONNECT_CHIP_CORNER_RADIUS = 8

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
// Crossing all four is a fifth thing, and it isn't a treatment: a live
// connection whose *grant* predates a scope the app has since started asking
// for (grantIsCurrent, lib/linkedin/scopes.ts). It keeps the green block — the
// token still works for what it was granted — and swaps the countdown chip for
// a Reconnect that says why.
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
  canReconnect = true,
  onDisconnect,
  onReconnect,
}: {
  account: ConnectedSocialAccount
  label: string
  now: Date
  pending: boolean
  // False for a platform that has been withdrawn (X — see PLATFORMS in
  // connections-panel.tsx). The row still renders, because a live connection
  // with a stored token must not become invisible, but every control that
  // would *make* a connection goes: no Reconnect, no Renew, no stale-grant
  // chip. A dead one offers Disconnect instead, which is the only thing left
  // that can actually be done about it — an authorize redirect for a platform
  // the app no longer offers is a dead end wearing a button.
  canReconnect?: boolean
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

  // A fifth thing a live connection can be: granted under an older, smaller
  // scope list than the app now asks for. Orthogonal to the four treatments
  // above — the token still works for what it *was* granted, so this is not a
  // dead row — which is why it's its own flag rather than another
  // ConnectionStatus value with a precedence puzzle attached. Only ever true
  // after a scope is added to a platform's list; before then every row matches.
  //
  // Per-platform inside isGrantStale (lib/social-scopes.ts), and that is
  // load-bearing rather than tidiness: each provider's scope strings are
  // meaningless to the other, so asking LinkedIn's question of an X row put a
  // permanent "Reconnect to grant Presto permission to post" chip on every
  // connected X account — for a permission X was never asked for, and which
  // reconnecting could not clear. Both platforms now have a real answer: X's
  // grants predating tweet.write (2026-09-04) are genuinely stale.
  const grantIsStale =
    canReconnect && !isDead && isGrantStale(account.platform, account.scope)

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
            isDead && canReconnect ? (
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
                : // The handle is the more recognisable identity on X, and the
                  // one that disambiguates two accounts under the same display
                  // name. LinkedIn has none, so it falls back to the name
                  // alone rather than the row needing to know the platform.
                  `Connected as ${
                    account.accountHandle
                      ? `@${account.accountHandle}`
                      : account.accountName
                  }`}
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

          {/* One chip, not two. A stale grant wins over the expiry warning:
              both are asking for the same click, and the reason that survives
              it is the one about a permission the connection doesn't have —
              renewing a token that already works reads as optional, and this
              isn't. */}
          {grantIsStale ? (
            <ReconnectChip
              pending={pending}
              onReconnect={onReconnect}
              label="Reconnect"
              tooltip="Reconnect to grant Presto permission to post"
            />
          ) : (
            canReconnect &&
            status === "expiring" && (
              <ReconnectChip
                pending={pending}
                onReconnect={onReconnect}
                label="Renew now"
                tooltip="Renew now to avoid having to authorize all over again"
              />
            )
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
//
// Two states share it (expiring, and a grant that predates a scope), because
// both are the same authorize redirect and differ only in why they're asking.
function ReconnectChip({
  pending,
  onReconnect,
  label,
  tooltip,
}: {
  pending: boolean
  onReconnect: () => void
  label: string
  tooltip: string
}) {
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: RECONNECT_CHIP_CORNER_RADIUS,
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
            onClick={onReconnect}
            aria-label={`${label} connection`}
            className="flex shrink-0 items-center gap-dist-sm rounded-rad-md bg-surface-2 px-pad-sm py-pad-2xs text-body-lg-bold text-text-bold transition-[scale] duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
          >
            {pending ? (
              <SpinnerGap weight="bold" className="size-5 animate-spin" />
            ) : (
              label
            )}
          </button>
        }
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export { ConnectedAccountRow }
