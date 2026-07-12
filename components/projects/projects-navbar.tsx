"use client"

import Image from "next/image"
import Link from "next/link"
import { Gear } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

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

export function ProjectsNavbar({ userName }: { userName: string }) {
  const { ref: chipRef, style: chipStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: CHIP_CORNER_RADIUS,
      cornerSmoothing: 1,
    })

  return (
    <header className="flex items-center justify-between">
      <PrestoLogoMono />

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
          variant="brand"
          size="icon-md"
          // Base UI requires this when `render` swaps the underlying element
          // to a non-<button> (here a Link) — silences its semantics warning.
          nativeButton={false}
          render={<Link href="/settings" aria-label="Settings" />}
        >
          <Gear weight="fill" />
        </Button>
      </div>
    </header>
  )
}
