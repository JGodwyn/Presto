"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"

import {
  AVATAR_GRADIENTS,
  GradientAvatar,
} from "@/components/shared/gradient-avatar"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { springLinearEasing } from "@/lib/spring-easing"
import { cn } from "@/lib/utils"

// Figma --rad-lg as px for the squircle path math — see
// hooks/use-squircle-clip-path.ts.
const CARD_CORNER_RADIUS = 16

// The export's Pointer frame is 12px tall and sits *between* the avatar and
// the card. That gap has to be reserved by the positioner — with sideOffset 0
// the card sits flush against the anchor and paints straight over the arrow,
// which is exactly the "tip is hidden on open" symptom.
const POINTER_HEIGHT = 12

// Tuned on a DialKit panel and frozen here once the feel was right — the panel
// is gone; git history has it if this ever needs re-tuning. Same treatment as
// toast.tsx's entrance, use-shake.ts and the day deck's fan.
//
// `fade` finishing before `duration` is deliberate: the card is solid while
// the bounce is still settling, which is what keeps a bouncing entrance from
// reading as a flicker. And the exit collapses *further* than the entrance
// grew from (0.7 vs 0.8) — going smaller on the way out reads as being put
// away rather than merely reversed.
const ENTER = { duration: 320, scale: 0.8, bounce: 0.25, fade: 200 }
const EXIT = { duration: 200, scale: 0.7 }

// The export's own DROP_SHADOW on the Tooltip frame is radius 8 at 24%.
// Deliberately heavier: against the real dark card on the real canvas that all
// but disappeared.
const SHADOW = "0 2px 16px rgba(25, 25, 25, 0.4)"

// Computed once — the bounce is a constant now, so there's no reason to
// re-sample the spring on every render.
const ENTER_EASING = springLinearEasing(ENTER.bounce)

// The dashed upload cell, drawn as an SVG rather than a CSS `border-dashed`:
// CSS gives no control over dash length, gap, or cap shape, and the design
// calls for round caps with a wider gap than the browser's default dash.
function DashedRing({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      aria-hidden
    >
      {/* r=19 keeps the 2px stroke inside the 40px box. The dasharray is
          "dash gap" in user units; round caps extend each dash by half the
          stroke width at both ends, so the dash is kept short and the gap
          generous to stop them merging back into a solid ring. */}
      <circle
        cx="20"
        cy="20"
        r="19"
        stroke="var(--border-bold)"
        strokeWidth="2"
        strokeDasharray="0.5 7"
        strokeLinecap="round"
      />
    </svg>
  )
}

// "Profile image" picker (Figma "ProfileScreenPickProfile"): a dark card
// hanging under the avatar with an upload cell followed by every gradient.
//
// **The export draws 24 swatches but only 6 distinct gradients** — the other
// 18 are the default repeated, i.e. placeholder fill. Rather than render 19
// identical circles, this maps the real list (components/shared/
// gradient-avatar.tsx) and lets the row wrap, so the grid grows as gradients
// are added instead of being pinned to a 5×5 that can't be filled honestly.
export function AvatarGradientPopover({
  open,
  onOpenChange,
  selectedGradientId,
  hasPhoto,
  onPickGradient,
  onPickUpload,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedGradientId: string | null
  // A photo outranks any gradient, so while one is set no swatch reads as
  // chosen — picking one is what replaces it.
  hasPhoto: boolean
  onPickGradient: (id: string) => void
  onPickUpload: () => void
  children: React.ReactNode
}) {
  const { ref: cardRef, style: cardStyle } = useSquircleClipPath<HTMLDivElement>(
    { cornerRadius: CARD_CORNER_RADIUS }
  )

  const duration = open ? ENTER.duration : EXIT.duration

  // **The values ride CSS variables, not the `style` prop.** Base UI's Popup
  // writes its own `style` attribute straight to the DOM, outside React, which
  // clobbers anything passed in that way — the same trap dialog.tsx documents.
  // Measured: the arrow (a plain element) picked up an inline duration while
  // the popup silently fell back to Tailwind's 150ms default. Variables set on
  // the positioner inherit down to both, and nothing overwrites them.
  const motionVars = {
    "--pop-duration": `${duration}ms`,
    "--pop-ease": open ? ENTER_EASING : "cubic-bezier(0.23,1,0.32,1)",
    "--pop-exit-scale": `${EXIT.scale}`,
    "--pop-enter-scale": `${ENTER.scale}`,
    "--pop-fade": `${ENTER.fade}ms`,
    "--pop-shadow": SHADOW,
  } as React.CSSProperties

  // Applied identically to the pointer and the card so the two move as one
  // object. Previously only the card carried the transition, so on close the
  // card animated away and the pointer simply vanished a frame later.
  //
  // Opacity is deliberately on its own shorter tween and never rides the
  // bounce: an overshooting fade passes 1, clamps, and reads as a flicker.
  //
  // **The from-states are Base UI's `data-starting-style` / `data-ending-style`
  // attributes, never a React `open ?` ternary.** That distinction is the whole
  // animation: by the time the element mounts, `open` is already true, so a
  // ternary renders it at its final scale with nothing to transition *from* —
  // it snaps, and every dial then appears to do nothing. Base UI mounts the
  // element carrying `data-starting-style`, clears it a frame later, and the
  // transition runs between the two. Same pattern as dialog.tsx.
  const motionClassName = cn(
    "relative origin-(--transform-origin) motion-reduce:transition-none",
    // One filter on the whole assembly, so the shadow traces the card *and*
    // the tip as a single silhouette rather than outlining each separately.
    "[filter:drop-shadow(var(--pop-shadow))]",
    "[transition-property:opacity,scale]",
    "[transition-duration:var(--pop-fade),var(--pop-duration)]",
    "[transition-timing-function:cubic-bezier(0.23,1,0.32,1),var(--pop-ease)]",
    "data-starting-style:opacity-0 data-starting-style:[scale:var(--pop-enter-scale)]",
    "data-ending-style:opacity-0 data-ending-style:[scale:var(--pop-exit-scale)]"
  )

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger render={children as React.ReactElement} />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="center"
          sideOffset={POINTER_HEIGHT}
          style={motionVars}
        >
          {/* Both halves scale from the anchor's own edge, so the pointer
              stays glued to the card's top edge the whole way. */}
          <Popover.Popup className={motionClassName}>
            {/* **The tip is drawn inside the popup, not as a Popover.Arrow.**
                As a sibling it was a separate element scaling around its own
                transform-origin while the card scaled around the anchor's —
                two objects moving at different rates in screen space, which
                is why it looked detached for a beat on open and close. Inside
                the popup it belongs to the same scaled subtree and physically
                cannot drift.

                Safe to hand-place because this popover's side and align are
                fixed (`bottom` / `center`), so the tip is always top-centre;
                that's the one thing Popover.Arrow was buying, and it isn't
                needed here. It sits outside the clipped card below, since a
                clip-path would cut it off. */}
            <span
              aria-hidden
              className="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-full"
              style={{ top: 1 }}
            >
              <svg
                width="16"
                height="11"
                viewBox="0 0 16 11"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="rotate-180"
              >
                <path
                  d="M9.73649 7.96115C8.9687 9.30478 7.0313 9.30478 6.26351 7.96115L1.70987 -0.00772251C0.94798 -1.34104 1.91071 -3 3.44636 -3L12.5536 -3C14.0893 -3 15.052 -1.34103 14.2901 -0.00772141L9.73649 7.96115Z"
                  className="fill-surface-inverse"
                />
              </svg>
            </span>

            <div
              ref={cardRef}
              style={cardStyle}
              className="flex w-65.5 flex-col items-center gap-dist-lg rounded-rad-lg bg-surface-inverse pt-pad-sm pr-pad-md pb-pad-md pl-pad-md max-md:w-88 max-md:py-pad-lg"
            >
              <p className="text-body-md text-text-inverse">Profile image</p>

              {/* flex-wrap, not a fixed grid: the export's row is `wrap=True`
                  and the number of gradients is a list that grows. */}
              <div className="flex w-full flex-wrap justify-center gap-dist-md">
                <button
                  type="button"
                  onClick={onPickUpload}
                  aria-label="Upload a picture"
                  className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[scale] duration-150 ease-out active:scale-[0.95] max-md:size-14"
                >
                  <DashedRing className="absolute inset-0 size-full" />
                  {/* The export's plus is a glyph, not a Phosphor icon — two
                      round-capped strokes at icon-minimal, matching the ring's
                      own cap treatment. */}
                  <svg
                    viewBox="0 0 20 20"
                    className="relative size-5"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M10 4.5V15.5M4.5 10H15.5"
                      stroke="var(--icon-minimal)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>

                {AVATAR_GRADIENTS.map((gradient) => {
                  const selected =
                    !hasPhoto && gradient.id === selectedGradientId
                  return (
                    <button
                      key={gradient.id}
                      type="button"
                      onClick={() => onPickGradient(gradient.id)}
                      aria-label={`Use the ${gradient.id} gradient`}
                      aria-pressed={selected}
                      className={cn(
                        "shrink-0 cursor-pointer rounded-full transition-[scale,box-shadow] duration-150 ease-out active:scale-[0.95]",
                        // A ring rather than a border: a border would resize
                        // the swatch and shift every one after it.
                        selected &&
                          "ring-2 ring-surface-4 ring-offset-2 ring-offset-surface-inverse"
                      )}
                    >
                      <GradientAvatar
                        gradientId={gradient.id}
                        size={40}
                        className="max-md:size-14"
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
