"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { Menu, MenuItem } from "@/components/ui/menu"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// The pill is a full capsule (--rad-rd) at 32px tall, so the squircle path
// wants half the height as its radius.
const PILL_CORNER_RADIUS = 16

export interface SelectPillOption {
  value: string
  label: string
  icon?: React.ReactNode
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
  children,
}: {
  options: SelectPillOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
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

  const openMenu = () => {
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)))
    setKeyboardActive(false)
    setOpen(true)
  }

  const pick = (option: SelectPillOption) => {
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
      setMenuRect({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    updateRect()
    window.addEventListener("scroll", updateRect, true)
    window.addEventListener("resize", updateRect)
    return () => {
      window.removeEventListener("scroll", updateRect, true)
      window.removeEventListener("resize", updateRect)
    }
  }, [open])

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
      setActiveIndex((activeIndex + 1) % options.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setKeyboardActive(true)
      setActiveIndex((activeIndex - 1 + options.length) % options.length)
    } else if (event.key === "Enter" || event.key === " ") {
      // preventDefault stops the button's own click from re-toggling the
      // menu right after we close it here.
      event.preventDefault()
      pick(options[activeIndex])
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <>
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
        className="group/select-pill flex h-8 cursor-pointer items-center gap-dist-sm rounded-full bg-surface-3 px-pad-md text-body-lg transition-colors duration-150 ease-out outline-none hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {children}
      </button>
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
                containerClassName="transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
                className="max-h-70"
              >
                {options.map((option, index) => (
                  <MenuItem
                    key={option.value}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={option.value === value}
                    highlighted={keyboardActive && index === activeIndex}
                    withDivider={index > 0}
                    onClick={() => pick(option)}
                  >
                    {option.icon}
                    {option.label}
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
