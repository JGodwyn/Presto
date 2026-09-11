"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { Menu, MenuItem } from "@/components/ui/menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"

// The desktop pill is 32px tall; mobile grows to 40px while retaining this
// Figma smoothed-corner radius.
const PILL_CORNER_RADIUS = 16
// The menu uses MenuItem's md rows (40px) and its existing max-h-70 cap
// (280px). These values let the portaled positioner choose a side before the
// menu has painted, so it never first appears beyond a phone edge.
const MENU_ITEM_HEIGHT_PX = 40
const MENU_MAX_HEIGHT_PX = 280
const MENU_GAP_PX = 8
const VIEWPORT_EDGE_GUTTER_PX = 8

type MenuPlacement = "above" | "below"

export interface SelectPillOption {
  value: string
  label: string
  icon?: React.ReactNode
  // Rendered as a dimmed, unselectable row (the export's own greyed state).
  // The Generate page's account pill uses it for a platform this project
  // hasn't connected.
  disabled?: boolean
}

// Capsule-shaped dropdown trigger for the generate card's model/account
// pickers. The menu is portaled to <body> for the same reason as
// TopicPicker's: every ancestor here (the stepper box, the page panel) is
// squircle-clipped, and clip-path clips absolutely positioned descendants
// too — an in-place menu would be cut off at the box edge.
export function SelectPill({
  options,
  value,
  onChange,
  ariaLabel,
  tooltip,
  className,
  children,
}: {
  options: SelectPillOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  // What the pill is for, on hover. The trigger *is* the tooltip's anchor
  // (rather than a wrapper around it) so the bubble points at the capsule
  // itself and picks up focus as well as hover.
  tooltip?: React.ReactNode
  // Merged onto the trigger button — the Generate page's own pills stay
  // borderless surface-3 (the default), but design-sync/regeneratemodal's
  // own model pill is a bordered surface-4 capsule instead.
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  // Same rule as TopicPicker: the highlighted-row border only appears once
  // the user starts moving with the keyboard, not the instant the menu opens.
  const [keyboardActive, setKeyboardActive] = React.useState(false)
  const listboxId = React.useId()
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const [menuRect, setMenuRect] = React.useState<{
    top: number
    left: number
    width: number
    maxHeight: number
    placement: MenuPlacement
  } | null>(null)

  const { ref: squircleRef, style: squircleStyle } =
    useSquircleClipPath<HTMLButtonElement>({
      cornerRadius: PILL_CORNER_RADIUS,
    })

  const setTriggerRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node
      squircleRef(node)
    },
    [squircleRef]
  )

  // Walks to the next selectable option in `delta`'s direction, wrapping.
  // Returns `from` unchanged when nothing else is selectable, so a list that
  // is entirely disabled can't spin forever.
  const nextEnabledIndex = (from: number, delta: number) => {
    const count = options.length
    for (let step = 1; step <= count; step++) {
      const index = (from + delta * step + count * count) % count
      if (!options[index].disabled) return index
    }
    return from
  }

  const openMenu = () => {
    const selectedIndex = options.findIndex((o) => o.value === value)
    // A disabled selection is reachable — the account pill's value comes back
    // from localStorage, and the account it names can have been disconnected
    // since. Start the keyboard on something actually pickable instead.
    const startIndex =
      selectedIndex >= 0 && !options[selectedIndex].disabled
        ? selectedIndex
        : options.findIndex((o) => !o.disabled)
    setActiveIndex(Math.max(0, startIndex))
    setKeyboardActive(false)
    setOpen(true)
  }

  const pick = (option: SelectPillOption | undefined) => {
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  // Runs before paint so the portaled menu never flashes at (0,0) on open;
  // re-measures on scroll/resize while open since a fixed-position element
  // doesn't move with the page on its own.
  React.useLayoutEffect(() => {
    if (!open) return
    const updateRect = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const desiredHeight = Math.min(
        MENU_MAX_HEIGHT_PX,
        options.length * MENU_ITEM_HEIGHT_PX
      )
      const spaceBelow = Math.max(
        0,
        window.innerHeight - rect.bottom - MENU_GAP_PX - VIEWPORT_EDGE_GUTTER_PX
      )
      const spaceAbove = Math.max(
        0,
        rect.top - MENU_GAP_PX - VIEWPORT_EDGE_GUTTER_PX
      )
      const placement: MenuPlacement =
        spaceBelow >= desiredHeight || spaceBelow >= spaceAbove
          ? "below"
          : "above"
      const availableHeight = placement === "below" ? spaceBelow : spaceAbove
      const maxHeight = Math.min(desiredHeight, availableHeight)

      setMenuRect({
        top:
          placement === "below"
            ? rect.bottom + MENU_GAP_PX
            : rect.top - MENU_GAP_PX - maxHeight,
        left: Math.max(
          VIEWPORT_EDGE_GUTTER_PX,
          Math.min(
            rect.left,
            window.innerWidth - rect.width - VIEWPORT_EDGE_GUTTER_PX
          )
        ),
        width: rect.width,
        maxHeight,
        placement,
      })
    }
    updateRect()
    window.addEventListener("scroll", updateRect, true)
    window.addEventListener("resize", updateRect)
    window.visualViewport?.addEventListener("resize", updateRect)
    return () => {
      window.removeEventListener("scroll", updateRect, true)
      window.removeEventListener("resize", updateRect)
      window.visualViewport?.removeEventListener("resize", updateRect)
    }
  }, [open, options.length])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        openMenu()
      }
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setKeyboardActive(true)
      setActiveIndex(nextEnabledIndex(activeIndex, 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setKeyboardActive(true)
      setActiveIndex(nextEnabledIndex(activeIndex, -1))
    } else if (event.key === "Enter" || event.key === " ") {
      // preventDefault stops the button's own click from re-toggling the
      // menu right after we close it here.
      event.preventDefault()
      pick(options[activeIndex])
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  const trigger = (
    <button
      ref={setTriggerRef}
      style={squircleStyle}
      type="button"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      onClick={() => (open ? setOpen(false) : openMenu())}
      onKeyDown={handleKeyDown}
      onBlur={() => setOpen(false)}
      // Hover mixes a touch of foreground into the resting surface — same
      // affordance recipe as Button's `secondary` variant. The group lets
      // trigger content (e.g. the account pill's caret) restyle itself
      // off this button's aria-expanded without SelectPill exposing its
      // open state.
      className={cn(
        "group/select-pill flex h-10 cursor-pointer items-center gap-dist-sm rounded-full bg-surface-3 px-pad-md text-body-lg transition-colors duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8",
        className
      )}
    >
      {children}
    </button>
  )

  return (
    <>
      {tooltip ? (
        // `disabled` while the menu is open: the tooltip and the menu both
        // hang off this button, and a bubble explaining a control the user
        // has already opened is just something else covering the options.
        <Tooltip disabled={open}>
          <TooltipTrigger render={trigger} />
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      {open && menuRect
        ? createPortal(
            <div
              style={{
                position: "fixed",
                top: menuRect.top,
                left: menuRect.left,
                // The pill hugs its content, so option labels can be wider
                // than the trigger — let the menu grow past it, never shrink
                // under it.
                minWidth: menuRect.width,
                width: "max-content",
                maxWidth: `calc(100vw - ${VIEWPORT_EDGE_GUTTER_PX * 2}px)`,
              }}
              className="z-50"
            >
              <Menu
                id={listboxId}
                role="listbox"
                aria-label={ariaLabel}
                // preventDefault keeps focus on the trigger while an option
                // is clicked — otherwise the trigger's blur closes the menu
                // before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                containerClassName={cn(
                  "transition-[opacity,translate] duration-150 ease-out starting:opacity-0 motion-reduce:starting:translate-y-0",
                  menuRect.placement === "below"
                    ? "starting:-translate-y-1"
                    : "starting:translate-y-1"
                )}
                className="max-h-70"
                style={{ maxHeight: menuRect.maxHeight }}
              >
                {options.map((option, index) => (
                  <MenuItem
                    key={option.value}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={option.value === value}
                    highlighted={keyboardActive && index === activeIndex}
                    withDivider={index > 0}
                    disabled={option.disabled}
                    // A disabled <button> swallows mouse events instead of
                    // bubbling them, so the Menu's own mousedown handler
                    // never runs and the trigger blurs — clicking a greyed
                    // row closed the whole menu. Taking the row out of
                    // hit-testing entirely lets the click land on the menu
                    // card itself, which keeps focus (and the menu) where it
                    // was.
                    className={option.disabled ? "pointer-events-none" : undefined}
                    onClick={() => pick(option)}
                  >
                    {/* Label fills, icon trails in its own 24px slot — the
                      export's "R.Slots" layout. (The trigger keeps its icon
                      leading; that content is the caller's own JSX.) A
                      disabled row's icon drops to the export's 10% opacity,
                      the text to text-minimal via MenuItem's own disabled
                      styling. */}
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.icon ? (
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center",
                          option.disabled && "opacity-10"
                        )}
                      >
                        {option.icon}
                      </span>
                    ) : null}
                  </MenuItem>
                ))}
              </Menu>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
