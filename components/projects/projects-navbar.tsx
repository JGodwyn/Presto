"use client"

import Link from "next/link"
import { ArrowLeftIcon, WarningDiamond } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/shared/user-avatar"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import {
  CHROME_LOCK_CLASSNAME,
  CHROME_UNLOCK_CLASSNAME,
  useGenerationLock,
} from "@/hooks/use-generation-lock"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Figma --rad-lg as a pixel number for the squircle path math (same reason
// as dialog.tsx: the clip-path calculation can't read CSS vars).
const CHIP_CORNER_RADIUS = 16

// Figma "Logo / Type=mono": three copies of the wordmark stacked with small
// x-offsets (2 / 10 / 6px, last on top) to fake an extruded edge — dark left,
// white right. The offsets are part of the vector art, not spacing tokens.
function PrestoLogoMono() {
  return (
    <div
      role="img"
      aria-label="Presto"
      className="relative h-14 w-34 text-heading-lg font-display"
    >
      <span aria-hidden className="absolute top-1 left-0.5 text-gray-500">
        Presto
      </span>
      <span aria-hidden className="absolute top-1 left-2.5 text-gray-0">
        Presto
      </span>
      <span aria-hidden className="absolute top-1 left-1.5 text-gray-300">
        Presto
      </span>
    </div>
  )
}

// profileHref: the name chip is the way into the profile screen (there is no
// gear here any more). It points at the user-level /profile stub by default;
// inside a project the layout passes that project's profile path instead.
// backHref: only set inside a project (by ProjectTopbar) — the picker itself
// has nothing to go "back" to, so this navbar's /projects usage omits it.
export function ProjectsNavbar({
  userName,
  userId,
  avatarUrl,
  gradientId,
  profileHref = "/profile",
  backHref,
  expiredConnectionHref,
}: {
  userName: string
  userId?: string | null
  avatarUrl?: string | null
  gradientId?: string | null
  profileHref?: string
  backHref?: string
  expiredConnectionHref?: string
}) {
  const { ref: chipRef, style: chipStyle } =
    useSquircleClipPath<HTMLAnchorElement>({
      cornerRadius: CHIP_CORNER_RADIUS,
      cornerSmoothing: 1,
    })
  // Same lock as the sidebar: while a generation is running, Back and the
  // name chip are the other two ways off the page. This navbar also serves
  // /projects, where nothing can be generating, so reading the lock here
  // costs that screen nothing.
  const locked = useGenerationLock()

  return (
    <header
      inert={locked}
      className={cn(
        "flex items-center justify-between",
        locked ? CHROME_LOCK_CLASSNAME : CHROME_UNLOCK_CLASSNAME
      )}
    >
      <div className="flex items-center gap-dist-sm md:gap-dist-md">
        {backHref && (
          <>
            <div className="flex h-9 items-end md:hidden">
              <Button
                variant="brand-secondary"
                size="icon-sm"
                nativeButton={false}
                render={<Link href={backHref} aria-label="Back to projects" />}
              >
                <ArrowLeftIcon weight="bold" />
              </Button>
            </div>
            <Button
              variant="brand-secondary"
              size="icon-md"
              className="hidden md:inline-flex"
              nativeButton={false}
              render={<Link href={backHref} aria-label="Back to projects" />}
            >
              <ArrowLeftIcon weight="bold" />
            </Button>
          </>
        )}
        <div className="relative h-10 w-24 md:h-14 md:w-34">
          <div className="absolute top-0 left-0 origin-top-left scale-[0.714] md:scale-100">
            <PrestoLogoMono />
          </div>
        </div>
      </div>

      {/* The chip is the only way into the profile screen now that the gear
          is gone, so it's a real link — same press feedback as the folder
          cards on /projects (150ms per the animation standards). */}
      <div className="flex items-center gap-dist-md">
        <Link
          ref={chipRef}
          href={profileHref}
          style={chipStyle}
          className="flex items-center gap-dist-sm rounded-rad-lg bg-surface-inverse py-pad-xs pr-pad-md pl-pad-sm transition-[scale] duration-150 ease-out active:scale-[0.97] md:gap-dist-md"
        >
          <span className="md:hidden">
            <UserAvatar
              userId={userId}
              avatarUrl={avatarUrl}
              gradientId={gradientId}
              size={16}
            />
          </span>
          <span className="hidden md:block">
            <UserAvatar
            userId={userId}
            avatarUrl={avatarUrl}
            gradientId={gradientId}
            size={28}
          />
          </span>
          {/* max-w + truncate so a very long name can't stretch the chip off
              the edge of the navbar; min-w-0 is what lets a flex child shrink
              below its content width at all. */}
          <span className="min-w-0 max-w-40 truncate text-title-lg font-display text-text-inverse md:text-heading-sm">
            {userName}
          </span>
        </Link>

        {expiredConnectionHref && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={expiredConnectionHref}
                      aria-label="LinkedIn connection expired. Go to connections"
                    />
                  }
                  variant="outline"
                  size="icon-md"
                  cornerRadius={8}
                  className="size-10 rounded-[var(--rad-xmd)] !border-2 !border-border-danger !bg-surface-danger-light !text-icon-danger hover:!bg-surface-danger-light hover:!text-icon-danger"
                >
                  <WarningDiamond weight="bold" className="size-6" />
                </Button>
              }
            />
            <TooltipContent side="bottom" align="end" className="w-66">
              Your LinkedIn connection expired. Reconnect for your posts to go live.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  )
}
