"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"

import { PROJECT_NAV_ITEMS } from "@/components/shared/project-sidebar"
import { useOnboarding } from "@/components/onboarding/onboarding-context"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import {
  CHROME_LOCK_CLASSNAME,
  CHROME_UNLOCK_CLASSNAME,
  useGenerationLock,
} from "@/hooks/use-generation-lock"
import { startSectionNavigation } from "@/lib/section-navigation"
import { cn } from "@/lib/utils"

const NAV_CORNER_RADIUS = 16
const ITEM_CORNER_RADIUS = 16

// Tweak the dock shadow here. The four values are:
// x-offset / y-offset / blur / colour+opacity.
// Keep it on the outer wrapper: the inner nav is squircle-clipped, which
// would cut off its own shadow.
const TAB_BAR_SHADOW_CLASSNAME =
  "shadow-[0px_2px_32px_rgba(0,0,0,0.1)]"

function MobileProjectNavigationItem({
  href,
  label,
  active,
  current,
  icon: Icon,
  onNavigate,
  itemPath,
  registerElement,
}: {
  href: string
  label: string
  active: boolean
  current: boolean
  icon: (typeof PROJECT_NAV_ITEMS)[number]["icon"]
  onNavigate: () => void
  itemPath: string
  registerElement: (path: string, node: HTMLAnchorElement | null) => void
}) {
  const { ref, style } = useSquircleClipPath<HTMLAnchorElement>({
    cornerRadius: ITEM_CORNER_RADIUS,
    cornerSmoothing: 1,
  })
  const composedRef = React.useCallback(
    (node: HTMLAnchorElement | null) => {
      ref(node)
      registerElement(itemPath, node)
    },
    [itemPath, ref, registerElement]
  )

  return (
    <Link
      ref={composedRef}
      style={style}
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (current) {
          event.preventDefault()
          return
        }
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return
        }
        // Local state moves the highlight in this same render; the route and
        // loading overlay are allowed to catch up afterward.
        onNavigate()
        startSectionNavigation(href)
      }}
      className={cn(
        "relative z-10 flex h-pad-5xl min-w-0 flex-1 items-center justify-center rounded-rad-lg border-3 border-transparent px-pad-xs transition-[color,scale] duration-150 ease-out active:scale-[0.97]",
        active
          ? "flex-[1.0625] text-icon-inverse"
          : "text-icon-subtle"
      )}
    >
      <Icon weight="bold" className="size-8" />
    </Link>
  )
}

// The compact mobile equivalent of the desktop sidebar. The export keeps all
// five sections reachable as icon-only targets so the content rail stays at a
// usable width instead of surrendering space to a permanently open sidebar.
export function MobileProjectNavigation() {
  const pathname = usePathname()
  const { projectId } = useParams<{ projectId: string }>()
  const { activePath, step } = useOnboarding()
  const generationLocked = useGenerationLock()
  // The callout narrates a fixed sequence of sections in place. Letting the
  // dock change the page behind its blur breaks that sequence, so it is inert
  // for every numbered tour step without visually dimming it like generation.
  const locked = generationLocked || typeof step === "number"
  const [pending, setPending] = React.useState<{
    href: string
    path: string
  } | null>(null)
  const pathnamePath = PROJECT_NAV_ITEMS.find(({ path }) =>
    pathname.startsWith(`/projects/${projectId}/${path}`)
  )?.path
  // Keep the newest tap authoritative until *its* destination commits. When
  // taps overlap, an older route can arrive first; tying pending state to the
  // origin pathname made that intermediate commit erase the newer highlight.
  // Account routes still clear it immediately because they are outside the
  // five project tabs.
  const pendingPath =
    pending && pathnamePath && pathname !== pending.href
      ? pending.path
      : null
  // Profile belongs to the account, not the five project sections, so no dock
  // item is selected there. A numbered onboarding step still takes priority
  // over the real pathname while the tour is teaching that section.
  const displayedPath = activePath ?? pendingPath ?? pathnamePath
  const handleNavigate = React.useCallback(
    (path: string, href: string) => {
      setPending({ href, path })
    },
    []
  )

  const navElementRef = React.useRef<HTMLElement | null>(null)
  const indicatorElementRef = React.useRef<HTMLSpanElement | null>(null)
  const itemElementsRef = React.useRef(new Map<string, HTMLAnchorElement>())
  const { ref, style } = useSquircleClipPath<HTMLElement>({
    cornerRadius: NAV_CORNER_RADIUS,
    cornerSmoothing: 1,
  })
  const { ref: indicatorSquircleRef, style: indicatorStyle } =
    useSquircleClipPath<HTMLSpanElement>({
      cornerRadius: ITEM_CORNER_RADIUS,
      cornerSmoothing: 1,
    })
  const navRef = React.useCallback(
    (node: HTMLElement | null) => {
      navElementRef.current = node
      ref(node)
    },
    [ref]
  )
  const indicatorRef = React.useCallback(
    (node: HTMLSpanElement | null) => {
      indicatorElementRef.current = node
      indicatorSquircleRef(node)
      if (node && !node.dataset.ready) node.dataset.ready = "false"
    },
    [indicatorSquircleRef]
  )
  const registerItemElement = React.useCallback(
    (path: string, node: HTMLAnchorElement | null) => {
      if (node) itemElementsRef.current.set(path, node)
      else itemElementsRef.current.delete(path)
    },
    []
  )

  const positionIndicator = React.useCallback((animate: boolean) => {
    const indicator = indicatorElementRef.current
    const target = displayedPath
      ? itemElementsRef.current.get(displayedPath)
      : null
    if (!indicator || !target) return

    if (!animate) indicator.dataset.ready = "false"
    indicator.style.width = `${target.offsetWidth}px`
    indicator.style.transform = `translateX(${target.offsetLeft}px)`

    if (indicator.dataset.ready !== "true") {
      requestAnimationFrame(() => {
        indicator.dataset.ready = "true"
      })
    }
  }, [displayedPath])

  React.useLayoutEffect(() => {
    positionIndicator(true)
  }, [positionIndicator])

  React.useEffect(() => {
    const nav = navElementRef.current
    if (!nav) return
    const observer = new ResizeObserver(() => positionIndicator(false))
    observer.observe(nav)
    return () => observer.disconnect()
  }, [positionIndicator])

  return (
    <div
      className={cn(
        "w-full rounded-rad-lg",
        TAB_BAR_SHADOW_CLASSNAME,
        generationLocked ? CHROME_LOCK_CLASSNAME : CHROME_UNLOCK_CLASSNAME
      )}
    >
      <nav
        ref={navRef}
        style={style}
        aria-label="Project navigation"
        inert={locked}
        className="relative flex h-pad-6xl w-full items-center gap-0.5 rounded-rad-lg bg-surface-4 p-pad-xs"
      >
        {displayedPath && (
          <span
            ref={indicatorRef}
            style={indicatorStyle}
            aria-hidden
            className="absolute inset-y-pad-xs left-0 z-0 rounded-rad-lg border-3 border-purple-600 bg-purple-400 data-[ready=true]:transition-transform data-[ready=true]:duration-200 data-[ready=true]:ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:data-[ready=true]:transition-none"
          />
        )}
        {PROJECT_NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const href = `/projects/${projectId}/${path}`
          const active = displayedPath === path

          return (
            <MobileProjectNavigationItem
              key={path}
              href={href}
              label={label}
              icon={Icon}
              active={active}
              current={pathname === href}
              onNavigate={() => handleNavigate(path, href)}
              itemPath={path}
              registerElement={registerItemElement}
            />
          )
        })}
      </nav>
    </div>
  )
}
