"use client"

import * as React from "react"
import { MagnifyingGlass, PaintBrushHousehold } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"

// Figma --rad-xmd as px for the squircle path math. Same radius and surface as
// the "Show as" pill sitting directly below it, so the two read as one cluster
// of controls down the panel's right edge rather than two unrelated chips.
const CORNER_RADIUS = 12

// pad-xs either side in *both* states, which with the 4px each icon already
// has inside its own 32px button puts every glyph 8px in from its edge — the
// collapsed chip included, so the icon isn't wedged against the chip's sides.
// Since the padding is the same either way, only the width animates.
const EXPANDED_CLASSNAME = "w-70"
const COLLAPSED_CLASSNAME = "w-10"

// The clear button blurs in and out rather than just fading: it appears and
// disappears while the eye is on the text right beside it, and a blur reads as
// the control resolving into place instead of a hard cut. Kept short — this
// fires on the first and last character typed, so it has to stay out of the
// way. Never scale(0): 0.8 with the blur is the "nothing appears from nothing"
// rule in the animation standards.
const CLEAR_HIDDEN = { opacity: 0, scale: 0.8, filter: "blur(4px)" }
const CLEAR_VISIBLE = { opacity: 1, scale: 1, filter: "blur(0px)" }
const CLEAR_TRANSITION = { duration: 0.15, ease: [0.23, 1, 0.32, 1] } as const

// The Content header's search affordance: a search icon at the header's right
// end (this page's replacement for the panel's info marker) that expands into
// a search field on tap.
//
// Width is the animated property here, which the animation standards
// otherwise warn off (it triggers layout, unlike transform/opacity). A
// transform can't do this one: scaling the box would stretch the icon and the
// text with it, where what's wanted is a field growing out from behind an icon
// that keeps its own size and its own offset from the box's leading edge. It's
// one small element animating on an explicit tap, so the layout cost is a
// frame's worth of work on a handful of nodes — the same trade the app already
// makes for the deck's FLIP reorder.
//
// The query itself is owned by the caller: it filters the page, so the page
// has to hold it. Open/closed is this component's own business.
export function ContentSearch({
  value,
  onValueChange,
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  // The clip-path is recomputed from the element's real size on every resize,
  // so it follows the width transition frame by frame rather than snapping to
  // the end shape — see hooks/use-squircle-clip-path.ts.
  const { ref: squircleRef, style: squircleStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: CORNER_RADIUS })

  // Focus lands after the commit, not inside the click handler: until React
  // has re-rendered, the input is still the collapsed state's aria-hidden,
  // zero-width one, and Chrome blocks (and warns about) focus retained inside
  // an aria-hidden subtree.
  React.useLayoutEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const collapse = () => {
    onValueChange("")
    setOpen(false)
  }

  return (
    <div
      ref={squircleRef}
      style={squircleStyle}
      className={cn(
        // rounded-rad-xmd is the fallback shape until the squircle clip-path
        // is measured on mount, same as everywhere else in the app.
        "flex h-8 items-center rounded-rad-xmd bg-surface-3 px-pad-xs transition-[width,background-color,scale] duration-200 ease-[cubic-bezier(0.77,0,0.175,1)]",
        // Collapsed it's a button, so it takes the app's hover tint and press
        // scale (`:active` matches the ancestors of the pressed element, so
        // the whole chip scales rather than just the icon inside it).
        // Expanded it's a field, and neither belongs on a text input.
        open
          ? EXPANDED_CLASSNAME
          : cn(
              COLLAPSED_CLASSNAME,
              "hover:bg-[color-mix(in_oklch,var(--surface-3),var(--foreground)_5%)] active:scale-[0.97]"
            ),
        className
      )}
    >
      <button
        ref={buttonRef}
        type="button"
        // Expanded, the icon becomes the field's own affordance: tapping it
        // puts the caret back in the input rather than closing what you just
        // opened. Escape, the clear button and blurring an empty field are
        // what close it.
        onClick={() => (open ? inputRef.current?.focus() : setOpen(true))}
        aria-label="Search posts"
        aria-expanded={open}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-rad-xmd outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <MagnifyingGlass className="size-6 text-icon-subtle" />
      </button>

      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder="Search posts"
        // Untabbable and hidden from the tree while collapsed — the icon
        // button is the only control there. It stays mounted regardless:
        // the field has to exist for the box to expand around it.
        tabIndex={open ? 0 : -1}
        aria-hidden={open ? undefined : true}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          // Keyboard users land back on the icon button they opened, rather
          // than at the top of the document.
          collapse()
          buttonRef.current?.focus()
        }}
        // A field with something typed in it stays open when you look away —
        // the query is still filtering what you're looking at. An empty one
        // has nothing to keep on screen.
        //
        // This also covers the click that lands on the clear button: blur runs
        // before that click, while the value is still there, so the field
        // can't collapse out from under it.
        onBlur={() => {
          if (value.trim() === "") collapse()
        }}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-body-lg text-text-bold outline-none placeholder:text-text-subtle",
          // Fades in over the second half of the expansion rather than
          // sliding into view at full strength while the box is still
          // opening.
          "transition-opacity duration-150 ease-out",
          open ? "opacity-100 delay-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* AnimatePresence rather than the `starting:` mount-in used for
          conditionally-rendered adornments elsewhere: this one has to blur
          *out* as well, and React unmounts an element the moment it stops
          being rendered — @starting-style has nothing to say about leaving.
          Same machinery as toast.tsx. */}
      <AnimatePresence initial={false}>
        {open && value !== "" ? (
          <motion.button
            key="clear"
            type="button"
            // Clearing leaves the field open with the caret back in it — the
            // point of clearing is to type something else, not to put the
            // control away.
            onClick={() => {
              onValueChange("")
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            initial={CLEAR_HIDDEN}
            animate={CLEAR_VISIBLE}
            exit={CLEAR_HIDDEN}
            transition={CLEAR_TRANSITION}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-rad-xmd text-icon-subtle transition-colors duration-150 ease-out outline-none hover:text-icon-bold focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
          >
            <PaintBrushHousehold className="size-5" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
