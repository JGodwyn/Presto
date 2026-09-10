"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  Check,
  Eyes,
  FunnelSimple,
} from "@phosphor-icons/react"

import { SocialIcon } from "@/components/shared/social-icon"
import { Menu, MenuItem } from "@/components/ui/menu"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/hooks/use-scroll-thumb"
import { useIconSpin } from "@/hooks/use-icon-spin"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import {
  NO_CONTENT_FILTER,
  PLATFORM_FILTER_LABELS,
  isContentFilterActive,
  nextPlatformFilter,
  toggleTopicFilter,
  type ContentFilter,
  type PlatformFilter,
} from "@/lib/content-filter"
import { cn } from "@/lib/utils"

// Figma radii as px for the squircle path math: the header chip is rad-xmd,
// the Social row rad-md, each checkbox rad-sm.
const CHIP_CORNER_RADIUS = 12
const SOCIAL_CORNER_RADIUS = 8
const CHECKBOX_CORNER_RADIUS = 4

// The export draws a 216px menu; this is 24px wider by request, which buys the
// topic labels that much more room before they truncate. Kept in sync with the
// `w-60` on the card below by hand — the positioning maths needs the number.
const MENU_WIDTH_PX = 240
// Six 40px rows, the list height the export shows before it starts scrolling
// under its own thumb.
const TOPIC_LIST_MAX_HEIGHT = "max-h-60"

// How far the topics list dissolves at each end. Bottom is deeper for the same
// reason it is on the Content page's own scroll area: it's the only thing
// signalling there's more below, where the top fade only matters once you're
// already scrolling and know that.
const LIST_FADE_TOP_PX = 16
const LIST_FADE_BOTTOM_PX = 32

// The gap the export leaves between the chip and the menu below it (dist-md).
const MENU_OFFSET_PX = 8

// Which marks the Social row shows for each value — "All" draws every value it
// covers, which is what design-sync/content-filter-1 does with the two
// platforms and now includes Try out alongside them. "Try out" has no brand
// mark of its own, so it borrows the Eyes glyph every other try-out affordance
// uses (post-account-icon.tsx, the dashboard's platform bars).
const PLATFORM_ICONS: Record<PlatformFilter, Exclude<PlatformFilter, "all">[]> =
  {
    all: ["linkedin", "x", "tryout"],
    linkedin: ["linkedin"],
    x: ["x"],
    tryout: ["tryout"],
  }

function PlatformFilterIcons({ platform }: { platform: PlatformFilter }) {
  return (
    <>
      {PLATFORM_ICONS[platform].map((entry) =>
        entry === "tryout" ? (
          // 18px against the brand marks' 16, which is what makes the three
          // read as one size: Phosphor's Eyes paints 13.5×12.5 inside its own
          // box, where the LinkedIn mark fills its 16 square edge to edge, so
          // matching the boxes leaves the glyphs visibly unequal. Sized to the
          // painted mark, not the box — the same optical fit as FilterCheckbox's
          // size-3.5 Check inside a 20px well.
          <Eyes key={entry} weight="bold" className="size-4.5 text-icon-subtle" />
        ) : (
          <SocialIcon key={entry} platform={entry} className="size-4" />
        )
      )}
    </>
  )
}

// The 20px box in each topic row's right slot. Its border is an inset shadow
// rather than a real border, for the same reason menu.tsx's ring is: a border
// is painted with its own corner arcs and then clipped against the squircle
// path, and the two curves don't quite coincide.
function FilterCheckbox({ checked }: { checked: boolean }) {
  const { ref, style } = useSquircleClipPath<HTMLSpanElement>({
    cornerRadius: CHECKBOX_CORNER_RADIUS,
  })

  return (
    <span
      ref={ref}
      style={style}
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-rad-sm transition-colors duration-150 ease",
        checked
          ? "bg-surface-brand"
          : "bg-surface-3 shadow-[inset_0_0_0_var(--stroke-lg)_var(--border-subtle)]"
      )}
    >
      {checked ? (
        // Conditionally mounted, so `starting:` is what scales it in — the
        // same treatment pill-input.tsx gives its danger adornment.
        <Check
          weight="bold"
          className="size-3.5 text-icon-inverse transition-[opacity,scale] duration-150 ease-out starting:scale-75 starting:opacity-0"
        />
      ) : null}
    </span>
  )
}

// The Content header's filter: a chip beside the search control that opens the
// Figma "Content / Filter" menu — one social platform (a cycling row, not a
// dropdown) and any number of topics.
//
// Portaled to <body> rather than positioned in place, for the reason spelled
// out in topic-picker.tsx: GlowPanel's squircle is a clip-path, and clip-path
// clips *every* descendant including absolutely positioned ones, so a menu
// rendered in place would be cut off at the panel's edge instead of floating
// over the page.
export function ContentFilterMenu({
  filter,
  onFilterChange,
  topics,
}: {
  filter: ContentFilter
  onFilterChange: (filter: ContentFilter) => void
  // The topics actually present on this project's posts — see topicsInPosts.
  topics: string[]
}) {
  const [open, setOpen] = React.useState(false)
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [menuRect, setMenuRect] = React.useState<{
    top: number
    left: number
  } | null>(null)

  const { ref: chipRef, style: chipStyle } =
    useSquircleClipPath<HTMLButtonElement>({ cornerRadius: CHIP_CORNER_RADIUS })
  const { ref: socialRef, style: socialStyle } =
    useSquircleClipPath<HTMLButtonElement>({
      cornerRadius: SOCIAL_CORNER_RADIUS,
    })
  // No thumb on this list, by request — the native scrollbar stays hidden
  // either way (see the Conventions note in AGENTS.md: hiding it is the rule,
  // showing a custom one is a per-container call), and the edge fade below is
  // what says there's more to see. Same call the page-level `<main>` made.
  //
  // Each edge's fade is the scroll distance actually left there, so a list
  // that fits (or sits at an end) is never dimmed.
  const { ref: listRef, onScroll: handleListScroll } = useScrollFade({
    axis: "y",
    start: LIST_FADE_TOP_PX,
    end: LIST_FADE_BOTTOM_PX,
  })
  // The Social row cycles rather than opening a list, so its icon turns on
  // each tap — the same treatment (and hook) as the "Show as" pill.
  const { ref: socialIconRef, style: socialIconStyle, spin } = useIconSpin()

  // Runs before paint so the portaled menu never flashes at (0,0); re-measures
  // on scroll/resize while open, since a fixed element doesn't move with the
  // page on its own. Right-aligned to the chip, per the export.
  React.useLayoutEffect(() => {
    if (!open) return
    const updateRect = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuRect({
        top: rect.bottom + MENU_OFFSET_PX,
        left: rect.right - MENU_WIDTH_PX,
      })
    }
    updateRect()
    window.addEventListener("scroll", updateRect, true)
    window.addEventListener("resize", updateRect)
    return () => {
      window.removeEventListener("scroll", updateRect, true)
      window.removeEventListener("resize", updateRect)
    }
  }, [open])

  // Click-away and Escape. Pointerdown rather than click, so a press that
  // starts outside closes on the way down instead of waiting for the release.
  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target)) return
      // The chip's own click handler does the toggling; closing here as well
      // would fire twice and leave it open.
      if (anchorRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const active = isContentFilterActive(filter)
  const allTopics = filter.topics.length === 0

  return (
    <div ref={anchorRef} className="relative flex shrink-0">
      <button
        ref={chipRef}
        style={chipStyle}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Filter posts"
        aria-expanded={open}
        // 44×32 with a centred 24px glyph is the export's chip exactly — the
        // 10px that leaves either side isn't a padding token, so the centring
        // is what produces it rather than a made-up value.
        className="flex h-8 w-11 shrink-0 cursor-pointer items-center justify-center rounded-rad-xmd bg-surface-3 transition-[background-color,scale] duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
      >
        {/* The brand tint is not in the export, which only draws the rest
            state: a filter narrows the page silently, so the chip has to say
            when one is on or the missing posts just look like a bug. */}
        <FunnelSimple
          className={cn("size-6", active ? "text-icon-brand" : "text-icon-bold")}
        />
      </button>

      {open && menuRect
        ? createPortal(
            // Menu owns the card itself (squircle, ring, shadow); this wrapper
            // only places it. Menu's own ref goes to its scroll container, so
            // the click-away ref has to live out here.
            <div
              ref={menuRef}
              style={{ top: menuRect.top, left: menuRect.left }}
              className="fixed z-50"
            >
              <Menu className="w-60" role="dialog" aria-label="Filter posts">
                <div className="flex items-center justify-between p-pad-lg pb-pad-sm">
                  <span className="text-body-md-bold text-text-bold">
                    Filter
                  </span>
                  <button
                    type="button"
                    onClick={() => onFilterChange(NO_CONTENT_FILTER)}
                    disabled={!active}
                    aria-label="Reset filters"
                    className="flex cursor-pointer items-center justify-center text-icon-subtle transition-[color,scale] duration-150 ease-out outline-none hover:text-icon-bold focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.9] disabled:cursor-default disabled:text-icon-minimal"
                  >
                    <ArrowCounterClockwise className="size-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-dist-xs px-pad-lg py-pad-sm">
                  <span className="text-body-md text-text-subtle">Social</span>
                  <button
                    ref={socialRef}
                    style={socialStyle}
                    type="button"
                    onClick={() => {
                      spin()
                      onFilterChange({
                        ...filter,
                        platform: nextPlatformFilter(filter.platform),
                      })
                    }}
                    // Cycles rather than opening a list of three, and the
                    // ArrowsClockwise says so — the same control the "Show as"
                    // pill uses, which is where that icon already means this.
                    aria-label={`Social: ${PLATFORM_FILTER_LABELS[filter.platform]} — tap to change`}
                    className="flex h-8 w-full cursor-pointer items-center gap-dist-md rounded-rad-md bg-surface-3 px-pad-sm py-pad-xs transition-[background-color,scale] duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
                  >
                    <span className="flex shrink-0 items-center gap-dist-sm">
                      <PlatformFilterIcons platform={filter.platform} />
                    </span>
                    <span className="flex-1 truncate text-left text-body-lg text-text-bold">
                      {PLATFORM_FILTER_LABELS[filter.platform]}
                    </span>
                    <ArrowsClockwise
                      ref={socialIconRef}
                      weight="bold"
                      style={socialIconStyle}
                      className="size-4 shrink-0 text-icon-subtle"
                    />
                  </button>
                </div>

                {/* No horizontal padding on this section, unlike the two
                    above: the rows keep MenuItem's own `px-pad-md`, which with
                    its transparent stroke-xl border lands their labels exactly
                    16px in — flush with the "Topics" heading above and the
                    "Social" one above that. The list therefore spans the
                    card's full width, which is what lets each row's divider
                    run edge to edge. Bleeding the dividers out of a narrower
                    list can't work — `overflow-y: auto` forces `overflow-x` to
                    a scrolling value too, so anything past the list's own box
                    gets clipped. */}
                <div className="flex flex-col pt-pad-sm pb-pad-lg">
                  <span className="px-pad-lg text-body-md text-text-subtle">
                    Topics
                  </span>
                  <div
                    ref={listRef}
                    onScroll={handleListScroll}
                    className={cn(
                      "flex flex-col overflow-y-auto",
                      TOPIC_LIST_MAX_HEIGHT,
                      HIDE_NATIVE_SCROLLBAR_CLASSNAME
                    )}
                  >
                    <MenuItem
                      onClick={() => onFilterChange({ ...filter, topics: [] })}
                      role="menuitemradio"
                      aria-checked={allTopics}
                    >
                      <span className="flex-1 truncate">All topics</span>
                      {allTopics ? (
                        <Check
                          weight="bold"
                          className="size-6 shrink-0 text-icon-success transition-[opacity,scale] duration-150 ease-out starting:scale-75 starting:opacity-0"
                        />
                      ) : null}
                    </MenuItem>

                    {topics.map((topic) => {
                      const checked = filter.topics.includes(topic)
                      return (
                        <MenuItem
                          key={topic}
                          onClick={() =>
                            onFilterChange({
                              ...filter,
                              topics: toggleTopicFilter(filter.topics, topic),
                            })
                          }
                          role="menuitemcheckbox"
                          aria-checked={checked}
                          withDivider
                          // left/right, not `before:inset-x-0`: MenuItem's
                          // own `before:inset-x-pad-md` survives
                          // tailwind-merge (a named spacing value it doesn't
                          // recognise as part of the inset group), so the
                          // two both land in the stylesheet and *CSS* order
                          // decides — which the inset shorthand wins. The
                          // longhands are ordered after it, so these do.
                          // The negative offsets cancel MenuItem's own
                          // transparent border (stroke-xl), which insets the
                          // padding box a pseudo-element is positioned
                          // against — the same cancellation its
                          // `-top-[…stroke-xl]` already does vertically.
                          className="before:-left-[length:var(--stroke-xl)] before:-right-[length:var(--stroke-xl)]"
                        >
                          <span className="flex-1 truncate">{topic}</span>
                          <FilterCheckbox checked={checked} />
                        </MenuItem>
                      )
                    })}
                  </div>
                </div>
              </Menu>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
