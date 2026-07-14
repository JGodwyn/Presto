"use client"

import { useLinkStatus } from "next/link"
import { SpinnerGap } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

// Sits inside a folder card's <Link> on /projects (useLinkStatus reads the
// nearest ancestor Link): a spinner in the folder's top-left while the
// project's layout does its server work (auth + project fetch). That leg
// deliberately has no loading.tsx — the folders page should stay visible
// under the click — so this is the only "something's happening" signal.
// Always rendered at fixed size and toggled via opacity (never mounted/
// unmounted) per the useLinkStatus docs' layout-shift note; the 100ms
// transition delay keeps fast navigations flash-free, and the spin itself
// is linear per the animation standards (constant motion → linear).
export function FolderLoadingIndicator() {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-pad-lg left-pad-xl text-text-inverse transition-opacity duration-150 ease",
        pending ? "opacity-100 [transition-delay:100ms]" : "opacity-0"
      )}
    >
      <SpinnerGap weight="bold" className="size-5 animate-spin" />
    </span>
  )
}
