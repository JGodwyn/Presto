"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import {
  CalendarDots,
  ChalkboardTeacher,
  FolderSimple,
  HouseSimple,
  MagicWand,
  PlugsConnected,
  type Icon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { useOnboarding } from "@/components/onboarding/onboarding-context"

// Figma --rad-* as pixel numbers for the squircle path math (same reason as
// projects-navbar: the clip-path calculation can't read CSS vars).
const CARD_CORNER_RADIUS = 16 // rad-lg
const ITEM_CORNER_RADIUS = 12 // rad-xmd

// Section paths inside a project — prefixed with /projects/<id> at render
// time. Labels follow the Figma "Dashboard" frame ("Content", not "Content
// Calendar"); the calendar route keeps its existing path.
const NAV_ITEMS: { path: string; label: string; icon: Icon }[] = [
  { path: "dashboard", label: "Dashboard", icon: HouseSimple },
  { path: "instructions", label: "Instructions", icon: ChalkboardTeacher },
  { path: "generate", label: "Generate", icon: MagicWand },
  { path: "calendar", label: "Content", icon: CalendarDots },
  { path: "connections", label: "Connections", icon: PlugsConnected },
]

function SidebarItem({
  href,
  label,
  icon: ItemIcon,
  active,
  onNavigate,
}: {
  href: string
  label: string
  icon: Icon
  active: boolean
  onNavigate: () => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLAnchorElement>({
    cornerRadius: ITEM_CORNER_RADIUS,
    cornerSmoothing: 1,
  })

  return (
    <Link
      ref={ref}
      style={style}
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-dist-md rounded-rad-xmd border-2 px-pad-md py-pad-sm",
        active
          ? "border-purple-600 bg-purple-400 text-body-lg-bold text-text-inverse"
          : "border-border-subtle bg-surface-3 text-body-lg text-text-bold"
      )}
    >
      <ItemIcon weight="bold" className="size-5" />
      <span>{label}</span>
    </Link>
  )
}

// The in-project sidebar from the Figma "Dashboard" frame: a white squircle
// card of pill nav items, with the pixel-gradient artwork and the current
// project's name pinned to the bottom.
export function ProjectSidebar({ projectName }: { projectName: string }) {
  const pathname = usePathname()
  const { projectId } = useParams<{ projectId: string }>()
  const { activePath } = useOnboarding()
  // The clicked item highlights immediately (optimistic), not when the
  // route commits — section navigations hit the server and the gap between
  // click and pathname change otherwise reads as a dead click.
  const [pendingPath, setPendingPath] = React.useState<string | null>(null)
  const { ref: cardRef, style: cardStyle } =
    useSquircleClipPath<HTMLElement>({
      cornerRadius: CARD_CORNER_RADIUS,
      cornerSmoothing: 1,
    })

  // Navigation committed (or was abandoned for another route) — hand the
  // highlight back to the real pathname.
  React.useEffect(() => {
    setPendingPath(null)
  }, [pathname])

  return (
    <aside
      ref={cardRef}
      style={cardStyle}
      // min-h-max: the card's own natural (max-content) height is nav's
      // height + the spacer's minimum + the folder-name block's own height +
      // card padding — all three are real in-flow content now (see below),
      // so max-content adds them up correctly on its own. Below that natural
      // height the card stops shrinking with the viewport and holds this
      // size instead.
      className="relative flex w-64 min-h-max shrink-0 flex-col overflow-hidden rounded-rad-lg bg-surface-4 p-pad-md"
    >
      {/* The 384×930 pixel-gradient artwork scaled to card width (the Figma
          frame shows it exactly this way: full image, natural aspect — white
          staircase in, deep violet at the foot). No crop; the card's clip
          rounds its bottom corners. loading="eager": this sidebar renders on
          every in-project page, so the image is always above the fold —
          Next was flagging it as the LCP element and asking for eager
          loading (this Next version deprecated `priority` in favor of
          `preload`, but its own docs say `loading="eager"` is what to reach
          for in the common case, which this is).
          Rendered first (before nav) so it always paints *behind* nav —
          both are positioned elements with the default stacking order, so
          DOM order alone keeps the image from ever visually covering the
          tabs at short viewport heights, without needing to resize, clip,
          or offset the image itself. */}
      <Image
        src="/images/dashboard/sidebar-gradient.webp"
        alt=""
        aria-hidden
        width={384}
        height={930}
        loading="eager"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-auto w-full"
      />

      <nav className="relative flex flex-col gap-dist-md">
        {NAV_ITEMS.map(({ path, label, icon }) => {
          const href = `/projects/${projectId}/${path}`
          // During the onboarding tour, the callout forces one item to
          // read as active regardless of the actual route — the tour
          // narrates sections in place without navigating. Outside it, a
          // just-clicked item wins over the (still old) pathname.
          const active = activePath
            ? path === activePath
            : pendingPath
              ? path === pendingPath
              : pathname.startsWith(href)
          return (
            <SidebarItem
              key={path}
              href={href}
              label={label}
              icon={icon}
              active={active}
              onNavigate={() => setPendingPath(path)}
            />
          )
        })}
      </nav>

      {/* Hardcoded (not a design token — an explicit call, not a guess): at
          least 80px between the tabs and the folder name below. flex-1 so it
          also soaks up any *extra* room in a tall viewport — pushing the
          folder-name block down to the card's true bottom edge, same as
          when that block was bottom-pinned directly — but min-h-20 stops it
          shrinking past 80px, which is also what stops the card's own
          min-h-max collapsing tighter than nav + this gap + the folder-name
          block's own height. A fixed-height spacer alone isn't enough here:
          the folder-name block can wrap to 3 lines (line-clamp-3) and grow
          taller than 80px on its own, which ate into a fixed gap entirely at
          the card's minimum height — this way its real height is always
          counted, not assumed away. */}
      <div aria-hidden className="min-h-20 flex-1" />

      {/* relative (not just in-flow): a static element paints *behind*
          positioned ones regardless of DOM order, so without this the
          (still-absolute) image above painted over it entirely — same
          stacking rule that keeps nav above the image, just the inverse
          failure mode. */}
      <div className="relative flex flex-col gap-dist-md p-pad-lg">
        <FolderSimple weight="bold" className="size-6 text-text-inverse" />
        <p className="line-clamp-3 text-title-lg font-display break-words text-text-inverse">
          {projectName}
        </p>
      </div>
    </aside>
  )
}
