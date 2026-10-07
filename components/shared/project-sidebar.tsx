"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import {
  CalendarDots,
  ChalkboardTeacher,
  FolderSimple,
  HouseSimple,
  MagicWand,
  PlugsConnected,
  WarningDiamond,
  type Icon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { startSectionNavigation } from "@/lib/section-navigation"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import {
  SIDEBAR_GRADIENT_ASPECT,
  SidebarGradient,
} from "@/components/shared/sidebar-gradient"
import {
  CHROME_LOCK_CLASSNAME,
  CHROME_UNLOCK_CLASSNAME,
  useGenerationLock,
} from "@/hooks/use-generation-lock"
import { useOnboarding } from "@/components/onboarding/onboarding-context"
import { useExpiredConnection } from "@/components/connections/expired-connection-provider"

// Figma --rad-* as pixel numbers for the squircle path math (same reason as
// projects-navbar: the clip-path calculation can't read CSS vars).
const CARD_CORNER_RADIUS = 16 // rad-lg
const ITEM_CORNER_RADIUS = 12 // rad-xmd

// Responsive sidebar sizing lives here: tablet is 192px (152 + 24 + 16),
// while desktop is 248px (the previous 272px minus 24).
const TABLET_SIDEBAR_WIDTH_CLASSNAME =
  "w-[calc(var(--dist-8xl)+var(--dist-xl)+var(--dist-lg))]"
const DESKTOP_SIDEBAR_WIDTH_CLASSNAME =
  "lg:w-[calc(var(--pad-9xl)+var(--dist-lg)-var(--dist-4xl))]"

// Section paths inside a project — prefixed with /projects/<id> at render
// time. Labels follow the Figma "Dashboard" frame ("Content", not "Content
// Calendar"); the calendar route keeps its existing path.
export const PROJECT_NAV_ITEMS: { path: string; label: string; icon: Icon }[] = [
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
  current,
  onNavigate,
  warning,
  animateHighlight,
}: {
  href: string
  label: string
  icon: Icon
  active: boolean
  current: boolean
  onNavigate: () => void
  warning?: boolean
  animateHighlight?: boolean
}) {
  const { ref, style } = useSquircleClipPath<HTMLAnchorElement>({
    cornerRadius: ITEM_CORNER_RADIUS,
    cornerSmoothing: 1,
  })

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Tapping the tab you're already on does nothing. Left alone it re-runs
    // the whole section navigation — refetch, spinner, scroll reset — over
    // content that's already on screen, which reads as the page breaking
    // rather than as anything the tap asked for.
    if (current) {
      event.preventDefault()
      return
    }
    // Cmd/ctrl/shift/alt clicks (and the middle button) open the section
    // somewhere else and never navigate *this* document, so they must not
    // arm an overlay that only arrival here can clear.
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return
    }
    onNavigate()
    // The click itself is the start signal, so the page spinner is armed
    // before the router has done anything at all — see lib/section-navigation
    // for why this doesn't go through `useLinkStatus`.
    startSectionNavigation(href)
  }

  return (
    <Link
      ref={ref}
      style={style}
      href={href}
      onClick={handleClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-dist-md rounded-rad-xmd border-2 px-pad-md py-pad-sm",
        // The tour moves the highlight down the list on its own clock, in
        // step with the callout card sliding (300ms, same curve), so it has
        // to travel rather than snap. A real tab tap stays instant — the
        // highlight there is feedback for the click, not narration.
        animateHighlight &&
          "transition-[background-color,border-color,color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
        active
          ? "border-purple-600 bg-purple-400 text-body-lg-bold text-text-inverse"
          : warning
            ? "border-border-danger bg-surface-3 text-body-lg text-text-bold"
            : "border-border-subtle bg-surface-3 text-body-lg text-text-bold"
      )}
    >
      <ItemIcon weight="bold" className="size-5 shrink-0" />
      <span>{label}</span>
      {warning && (
        <WarningDiamond
          weight="bold"
          className={cn(
            "ml-auto size-5 shrink-0",
            active ? "text-icon-inverse" : "text-icon-danger"
          )}
        />
      )}
    </Link>
  )
}

// The in-project sidebar from the Figma "Dashboard" frame: a white squircle
// card of pill nav items, with the pixel-staircase gradient and the current
// project's name pinned to the bottom.
export function ProjectSidebar({ projectName }: { projectName: string }) {
  const pathname = usePathname()
  // Dimmed and inert while a generation is running — leaving that page ends
  // the run, so the tabs must not be reachable by pointer *or* keyboard until
  // it stops. See lib/generation-lock.ts.
  const locked = useGenerationLock()
  const { projectId } = useParams<{ projectId: string }>()
  const { activePath, step } = useOnboarding()
  const { hasExpiredLinkedIn } = useExpiredConnection()
  // The clicked item highlights immediately (optimistic), not when the
  // route commits — section navigations hit the server and the gap between
  // click and pathname change otherwise reads as a dead click.
  const [pending, setPending] = React.useState<{
    fromPathname: string
    path: string
  } | null>(null)
  // Once Next commits any different route, the URL resumes ownership of the
  // active state. Storing the origin avoids a cleanup effect and also means a
  // cancelled navigation cannot leave a stale optimistic highlight behind.
  const pendingPath =
    pending?.fromPathname === pathname ? pending.path : null
  // Onboarding names these items in place, rather than navigating through
  // them. Keep the sidebar visible as the tour's visual reference, but leave
  // the callout's Next/Complete button as the only way to advance.
  const onboardingLocked = typeof step === "number"
  const interactionLocked = locked || onboardingLocked
  const { ref: cardRef, style: cardStyle } =
    useSquircleClipPath<HTMLElement>({
      cornerRadius: CARD_CORNER_RADIUS,
      cornerSmoothing: 1,
    })

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
      inert={interactionLocked}
      className={cn(
        "relative flex min-h-max shrink-0 flex-col overflow-hidden rounded-rad-lg bg-surface-4 p-pad-md",
        TABLET_SIDEBAR_WIDTH_CLASSNAME,
        DESKTOP_SIDEBAR_WIDTH_CLASSNAME,
        locked ? CHROME_LOCK_CLASSNAME : CHROME_UNLOCK_CLASSNAME
      )}
    >
      <nav className="relative flex flex-col gap-dist-md">
        {PROJECT_NAV_ITEMS.map(({ path, label, icon }) => {
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
              // Exact match, unlike `active` above: on a sub-route
              // (generate/generating) the Generate tab still highlights, but
              // tapping it has somewhere real to go and must not be a no-op.
              current={pathname === href}
              onNavigate={() => setPending({ fromPathname: pathname, path })}
              warning={path === "connections" && hasExpiredLinkedIn}
              animateHighlight={onboardingLocked}
            />
          )
        })}
      </nav>

      {/* Everything below the tabs. It's the box the gradient is allowed to
          fill, which is what keeps the artwork from ever running up behind
          the nav. */}
      <div className="relative flex flex-1 flex-col">
        {/* The staircase artwork (components/shared/sidebar-gradient.tsx),
            bled out to the card's left, right and bottom edges past its
            padding — the card's squircle clip rounds the bottom corners.
            It holds its natural aspect from the card's width, so it's the
            same shape at 192px and 224px; on a sidebar too short for that,
            max-h caps it at this box (plus the bottom bleed) and the stripes
            compress instead of sliding under the tabs. The texture is in
            real pixels, so it doesn't stretch when that happens.
            Rendered first so the folder-name block, later in the DOM and
            also positioned, paints over it. */}
        <SidebarGradient
          className="absolute -bottom-pad-md -left-pad-md h-auto max-h-[calc(100%+var(--pad-md))] w-[calc(100%+2*var(--pad-md))]"
          style={{ aspectRatio: SIDEBAR_GRADIENT_ASPECT }}
        />
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
            absolute gradient above painted over it entirely — same
            stacking rule that keeps nav above the image, just the inverse
            failure mode. */}
        <div className="relative flex flex-col gap-dist-md p-pad-lg">
          <FolderSimple weight="bold" className="size-6 text-text-inverse" />
          <p className="line-clamp-3 text-title-lg font-display break-words text-text-inverse">
            {projectName}
          </p>
        </div>
      </div>
    </aside>
  )
}
