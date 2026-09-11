"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  ArrowsOutSimpleIcon,
  DotsThree,
  PaperPlaneTilt,
  Scribble,
  Trash,
} from "@phosphor-icons/react"

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
  onPublish,
  publishComingSoon,
  onOpen,
  onTurnToDraft,
  onDelete,
}: {
  // Sends the post to the live account. Optional, and left out entirely where
  // the post can't go out at all (canAttemptPublish, lib/post-publish.ts) —
  // a control that is always going to be refused is worse than no control.
  // It sits at the top of the menu, above Open up: it is the consequential
  // one, and it is the only row here that does something irreversible and
  // public, so it gets a confirmation from the caller before anything is sent.
  onPublish?: () => void
  // The same row, disabled, for a post whose platform *will* be publishable —
  // X, whose publisher is built and switched off (PUBLISHABLE_PLATFORMS,
  // lib/post-publish.ts). Deliberately different from simply leaving the row
  // out, which is still what an already-published or try-out post gets: those
  // have nothing coming, while an X post beside a LinkedIn one otherwise looks
  // broken rather than pending. Ignored when `onPublish` is set — a post cannot
  // be both.
  publishComingSoon?: boolean
  // Opens the post's own page. Optional: only the callers that have somewhere
  // to send it pass this (the Content page's day deck), and the row is left
  // out entirely where they don't.
  onOpen?: () => void
  // Left out on a draft — there's no schedule to undo — and on a post that has
  // already gone out, where filing a published post as unwritten would say
  // something untrue about it (isPostLocked, lib/post-publish.ts).
  onTurnToDraft?: () => void
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
              {onPublish ? (
                <MenuItem
                  role="menuitem"
                  className="justify-between max-md:h-[var(--pad-4xl)] max-md:px-pad-lg"
                  onClick={() => {
                    onPublish()
                    setOpen(false)
                  }}
                >
                  Publish now
                  <PaperPlaneTilt weight="bold" />
                </MenuItem>
              ) : publishComingSoon ? (
                // MenuItem already styles `disabled` (text-minimal, no hover or
                // pressed surface), so this needs no new treatment — it reads as
                // a row that exists but isn't ready, which is exactly the state.
                // The label carries the reason: a disabled row can't hold a
                // tooltip, and "Publish now" greyed out says nothing.
                <MenuItem
                  role="menuitem"
                  disabled
                  className="justify-between max-md:h-[var(--pad-4xl)] max-md:px-pad-lg"
                >
                  Publishing coming soon
                  <PaperPlaneTilt weight="bold" />
                </MenuItem>
              ) : null}
              {onOpen ? (
                <MenuItem
                  role="menuitem"
                  withDivider={Boolean(onPublish || publishComingSoon)}
                  className="justify-between max-md:h-[var(--pad-4xl)] max-md:px-pad-lg"
                  onClick={() => {
                    onOpen()
                    setOpen(false)
                  }}
                >
                  Open up
                  <ArrowsOutSimpleIcon weight="bold" />
                </MenuItem>
              ) : null}
              {onTurnToDraft ? (
                <MenuItem
                  role="menuitem"
                  withDivider={Boolean(onPublish || publishComingSoon || onOpen)}
                  className="justify-between max-md:h-[var(--pad-4xl)] max-md:px-pad-lg"
                  onClick={() => {
                    onTurnToDraft()
                    setOpen(false)
                  }}
                >
                  Turn to draft
                  <Scribble weight="bold" />
                </MenuItem>
              ) : null}
              <MenuItem
                role="menuitem"
                variant="danger"
                withDivider={Boolean(
                  onPublish || publishComingSoon || onOpen || onTurnToDraft
                )}
                className="justify-between max-md:h-[var(--pad-4xl)] max-md:px-pad-lg"
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
