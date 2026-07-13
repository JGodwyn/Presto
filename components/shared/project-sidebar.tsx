"use client"

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
}: {
  href: string
  label: string
  icon: Icon
  active: boolean
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
  const { ref: cardRef, style: cardStyle } =
    useSquircleClipPath<HTMLElement>({
      cornerRadius: CARD_CORNER_RADIUS,
      cornerSmoothing: 1,
    })

  return (
    <aside
      ref={cardRef}
      style={cardStyle}
      className="relative flex w-64 shrink-0 flex-col overflow-hidden rounded-rad-lg bg-surface-4 p-pad-md"
    >
      <nav className="relative flex flex-col gap-dist-md">
        {NAV_ITEMS.map(({ path, label, icon }) => {
          const href = `/projects/${projectId}/${path}`
          return (
            <SidebarItem
              key={path}
              href={href}
              label={label}
              icon={icon}
              active={pathname.startsWith(href)}
            />
          )
        })}
      </nav>

      {/* The 384×930 pixel-gradient artwork scaled to card width (the Figma
          frame shows it exactly this way: full image, natural aspect — white
          staircase in, deep violet at the foot). No crop; the card's clip
          rounds its bottom corners. */}
      <Image
        src="/images/dashboard/sidebar-gradient.webp"
        alt=""
        aria-hidden
        width={384}
        height={930}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-auto w-full"
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-dist-md p-pad-lg">
        <FolderSimple weight="bold" className="size-6 text-text-inverse" />
        <p className="line-clamp-3 text-title-lg font-display break-words text-text-inverse">
          {projectName}
        </p>
      </div>
    </aside>
  )
}
