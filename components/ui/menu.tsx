"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma "Menu" (design-sync/menu) card radius as px for the squircle path
// math — see hooks/use-squircle-clip-path.ts.
const MENU_CORNER_RADIUS = 16

// Size=sm → 32px rows, Size=md → 40px. Both use body-lg text per the export.
const menuItemSizes = {
  sm: "h-8",
  md: "h-10",
} as const

interface MenuProps extends React.ComponentProps<"div"> {
  containerClassName?: string
}

// Minimum thumb height so a very long list doesn't shrink it to an
// unclickable/invisible sliver.
const MIN_THUMB_HEIGHT = 24
// Keeps the thumb's track inset from the top/bottom of the scroll box —
// without it, the thumb reaches flush edge-to-edge at the scroll extremes,
// which both looks flush against the squircle's curved corners (a straight-
// edged rect sitting right where the outline is already curving inward) and
// leaves no breathing room above/below. Matches pad-sm (8px).
const THUMB_TRACK_PADDING = 8

// The white floating card menu items live in. Four layers on purpose:
// - outer (relative): unclipped, carries the drop-shadow — clipping runs
//   after filters, so a drop-shadow on the squircle-clipped element itself
//   would be cut off at the clip region (same trick as toast.tsx).
// - scrollable card: the items, clipped to the squircle, native scrollbar
//   hidden. Flush edge-to-edge by design (matches the export) so the clip
//   crops the top/bottom rows' square corners to the card shape.
// - border overlay: a second squircle-clipped layer stacked *above* the
//   items, painting only the inset ring. It has to be a separate top layer
//   rather than a shadow on the scrollable card itself — a hovered row's
//   opaque background sits later in paint order than that card's own
//   box-shadow, so it would cover the ring wherever the row reaches the
//   edge (every row, since they're flush). Sitting on top and
//   pointer-events-none, it can't intercept clicks or be painted over.
// - thumb: a plain div tracking scroll position, not the browser's own
//   scrollbar. `::-webkit-scrollbar` customization (width/color/an inset
//   gap via border+background-clip) turned out to be silently ignored —
//   macOS's overlay-scrollbar rendering path doesn't appear to honor it, so
//   nothing about the native bar was ever actually under our control here.
//   A real element sidesteps that entirely at the cost of drag-to-scroll,
//   which nothing in this dropdown relies on (wheel/trackpad/arrow keys all
//   still work on the underlying overflow box).
// Positioning classes go on containerClassName; role/aria props land on the
// scrollable card, which is the direct parent of the items.
function Menu({
  containerClassName,
  className,
  onScroll,
  ...props
}: MenuProps) {
  const { ref: squircleRef, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: MENU_CORNER_RADIUS,
  })
  const { ref: borderRef, style: borderStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: MENU_CORNER_RADIUS,
    })
  const scrollElRef = React.useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = React.useState<{
    top: number
    height: number
  } | null>(null)

  const updateThumb = React.useCallback(() => {
    const el = scrollElRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight <= clientHeight) {
      setThumb(null)
      return
    }
    const trackHeight = clientHeight - THUMB_TRACK_PADDING * 2
    const height = Math.max(
      (clientHeight / scrollHeight) * trackHeight,
      MIN_THUMB_HEIGHT
    )
    const top =
      THUMB_TRACK_PADDING +
      (trackHeight - height) * (scrollTop / (scrollHeight - clientHeight))
    setThumb({ top, height })
  }, [])

  // Re-measures whenever the row count changes (typing filters the list) —
  // scrollHeight can change without the box's own rendered size changing
  // (it's pinned at max-h), which ResizeObserver alone wouldn't catch.
  React.useLayoutEffect(() => {
    updateThumb()
    const el = scrollElRef.current
    if (!el) return
    const observer = new ResizeObserver(updateThumb)
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateThumb, props.children])

  const setScrollRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      squircleRef(node)
      scrollElRef.current = node
    },
    [squircleRef]
  )

  return (
    <div
      className={cn(
        // Figma drop shadow: 0 2 16 at 10% black.
        "relative drop-shadow-[0px_2px_16px_rgba(0,0,0,0.10)]",
        containerClassName
      )}
    >
      <div
        ref={setScrollRef}
        style={style}
        onScroll={(event) => {
          updateThumb()
          onScroll?.(event)
        }}
        className={cn(
          "flex w-full flex-col overflow-y-auto rounded-rad-lg bg-menu-surface-rest [&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
          className
        )}
        {...props}
      />
      {/* Border ring, see the layering note above. Same inset-shadow-not-
          border technique as before: a real border is painted with its own
          corner arcs and clipped against the squircle path afterward, and
          the two curves don't quite coincide — the mismatch shows up as a
          jagged edge. An inset shadow is a filled shape clipped in the same
          pass as the rest of this layer, so it stays crisp. */}
      <div
        ref={borderRef}
        style={borderStyle}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-rad-lg shadow-[inset_0_0_0_var(--stroke-xl)_var(--border-subtle)]"
      />
      {thumb ? (
        // Offset past the ring (stroke-xl) plus a visible gap (dist-sm) —
        // a real, code-owned position rather than another CSS trick.
        <div
          aria-hidden
          className="pointer-events-none absolute w-1 rounded-full bg-surface-2 [right:calc(var(--stroke-xl)+var(--dist-sm))]"
          style={{ top: thumb.top, height: thumb.height }}
        />
      ) : null}
    </div>
  )
}

interface MenuItemProps extends React.ComponentProps<"button"> {
  size?: keyof typeof menuItemSizes
  variant?: "default" | "danger"
  highlighted?: boolean
  withDivider?: boolean
}

// One row of a Menu. `highlighted` renders the export's focused state (the
// border-focused outline) — used for the keyboard-active option in comboboxes,
// where DOM focus stays on the input. The divider is the inset top line from
// the Divider=On variant, drawn as a pseudo so rows stay single elements.
function MenuItem({
  size = "md",
  variant = "default",
  highlighted = false,
  withDivider = false,
  className,
  ...props
}: MenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        // The border is always present and transparent so the highlighted
        // state never shifts layout (same approach as pill-input). Same
        // width as the menu's own border ring (stroke-xl) so the focused
        // row's outline doesn't read as a thinner, different element.
        "relative flex w-full shrink-0 cursor-pointer items-center gap-dist-md border-[length:var(--stroke-xl)] border-transparent px-pad-md py-pad-xs text-left text-body-lg transition-colors duration-150 ease outline-none",
        "hover:bg-menu-surface-hover active:bg-menu-surface-pressed disabled:cursor-default disabled:bg-transparent",
        variant === "danger"
          ? "text-text-danger"
          : "text-text-bold disabled:text-text-minimal",
        highlighted && "border-border-focused",
        // -top-stroke-xl, not top-0: an absolutely positioned pseudo is
        // placed relative to its parent's *padding* box, which this
        // transparent border pushes stroke-xl inward from the true (border-
        // box) row boundary. top-0 was landing the line that much closer to
        // this row's own text than to the row above it, showing up as
        // uneven space around the text. The negative offset cancels the
        // border's inset so the line sits exactly on the row seam again.
        withDivider &&
          "before:absolute before:inset-x-pad-md before:-top-[length:var(--stroke-xl)] before:h-px before:bg-border-minimal",
        menuItemSizes[size],
        className
      )}
      {...props}
    />
  )
}

export { Menu, MenuItem }
