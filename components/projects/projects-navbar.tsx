"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowLeftIcon, Gear, GearFine } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import {
  CHROME_LOCK_CLASSNAME,
  CHROME_UNLOCK_CLASSNAME,
  useGenerationLock,
} from "@/hooks/use-generation-lock"
import { cn } from "@/lib/utils"

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

// settingsHref: the gear points at the user-level /settings stub by default;
// inside a project the layout passes that project's settings path instead.
// backHref: only set inside a project (by ProjectTopbar) — the picker itself
// has nothing to go "back" to, so this navbar's /projects usage omits it.
export function ProjectsNavbar({
  userName,
  settingsHref = "/settings",
  backHref,
}: {
  userName: string
  settingsHref?: string
  backHref?: string
}) {
  const { ref: chipRef, style: chipStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: CHIP_CORNER_RADIUS,
      cornerSmoothing: 1,
    })
  // Same lock as the sidebar: while a generation is running, Back and the
  // gear are the other two ways off the page. This navbar also serves
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
      <div className="flex items-center gap-dist-md">
        {backHref && (
          <Button
            variant="brand-secondary"
            size="icon-md"
            nativeButton={false}
            render={<Link href={backHref} aria-label="Back to projects" />}
          >
            <ArrowLeftIcon weight="bold" />
          </Button>
        )}
        <PrestoLogoMono />
      </div>

      <div className="flex items-center gap-dist-md">
        <div
          ref={chipRef}
          style={chipStyle}
          className="flex items-center gap-dist-md rounded-rad-lg bg-surface-inverse py-pad-xs pr-pad-md pl-pad-sm"
        >
          <Image
            src="/images/create-project/avatar.svg"
            alt=""
            width={28}
            height={28}
          />
          <span className="text-heading-sm font-display text-text-inverse">
            {userName}
          </span>
        </div>

        <Button
          variant="brand-secondary"
          size="icon-md"
          // Base UI requires this when `render` swaps the underlying element
          // to a non-<button> (here a Link) — silences its semantics warning.
          nativeButton={false}
          render={<Link href={settingsHref} aria-label="Settings" />}
        >
          <GearFine weight="bold" />
        </Button>
      </div>
    </header>
  )
}
