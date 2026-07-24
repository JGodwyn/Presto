"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { DotsThree, Scribble, Trash } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Menu, MenuItem } from "@/components/ui/menu"

// The scheduled-card top-right trigger (design-sync/ChangesToGenerateCard) —
// replaces the draft card's plain Delete button once a post has a date,
// since deleting a scheduled post is no longer the only thing you'd want to
// do with it. Same portal/positioning/outside-click mechanics as
// SelectPill (components/generate/select-pill.tsx): portaled to <body>
// because every ancestor card here is squircle-clipped, and clip-path clips
// absolutely positioned descendants too — an in-place menu would be cut off
// at the card's own edge. onBlur (trigger) + onMouseDown preventDefault
// (items) is what keeps focus on the trigger while an item is clicked, so
// the blur that closes the menu only fires for genuine outside clicks.
export function PostActionsMenu({
  onTurnToDraft,
  onDelete,
}: {
  onTurnToDraft: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const [menuRect, setMenuRect] = React.useState<{
    top: number
    right: number
  } | null>(null)

  React.useLayoutEffect(() => {
    if (!open) return
    const updateRect = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      // Right-aligned to the trigger (not left-anchored like SelectPill's
      // dropdown) — this button sits in a card's top-right corner, so a
      // left-anchored menu would run past the card's own right edge.
      setMenuRect({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
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

  return (
    <>
      {/* Measuring this wrapper rather than the Button itself — Button isn't
          forwardRef'd (it uses its own internal ref for the squircle
          clip-path), so an external ref passed straight to it would just
          silently replace that one via the props spread. A plain
          inline-flex div hugs the button's rendered size with no ref
          conflict. */}
      <div ref={triggerRef} className="inline-flex">
        <Button
          variant="brand-secondary"
          size="icon-sm"
          aria-label="Post actions"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          onBlur={() => setOpen(false)}
        >
          <DotsThree weight="bold" />
        </Button>
      </div>
      {open && menuRect
        ? createPortal(
            <div
              style={{ position: "fixed", top: menuRect.top, right: menuRect.right }}
              className="z-50 w-max"
            >
              <Menu
                role="menu"
                aria-label="Post actions"
                onMouseDown={(event) => event.preventDefault()}
                containerClassName="transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
              >
                <MenuItem
                  role="menuitem"
                  className="justify-between"
                  onClick={() => {
                    onTurnToDraft()
                    setOpen(false)
                  }}
                >
                  Turn to draft
                  <Scribble weight="bold" />
                </MenuItem>
                <MenuItem
                  role="menuitem"
                  variant="danger"
                  withDivider
                  className="justify-between"
                  onClick={() => {
                    onDelete()
                    setOpen(false)
                  }}
                >
                  Delete
                  <Trash weight="bold" />
                </MenuItem>
              </Menu>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
