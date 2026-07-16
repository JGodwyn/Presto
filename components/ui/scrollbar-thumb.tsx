import { cn } from "@/lib/utils"

// The visible half of useScrollThumb (hooks/use-scroll-thumb.ts) — a plain
// div standing in for the browser's own scrollbar thumb. Render it as a
// sibling of the scrollable element, inside a `relative` ancestor that isn't
// itself scrolling (see components/ui/menu.tsx's layering note for why it
// can't just live inside the scroll box). `className` is for the inset
// offset from the edge only (e.g. `right-1`) — width/shape/color are the
// fixed, app-wide look.
//
// Stays mounted (opacity-0) rather than unmounting while `visible` is false,
// so the very next scroll event can fade it straight in — matching the
// native overlay-scrollbar behavior of "visible while scrolling, hidden at
// rest" this replaces.
function ScrollbarThumb({
  thumb,
  visible,
  className,
}: {
  thumb: { top: number; height: number } | null
  visible: boolean
  className?: string
}) {
  if (!thumb) return null

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute w-1 rounded-full bg-surface-2 transition-opacity duration-150 ease-out",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ top: thumb.top, height: thumb.height }}
    />
  )
}

export { ScrollbarThumb }
