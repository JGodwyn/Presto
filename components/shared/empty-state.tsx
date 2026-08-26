import type { Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

// The app's one empty/blank-page layout, from the Figma "Empty state" export
// (design-sync/empty-state). Three stacked pieces, centred in whatever space
// they're given:
//
//   icon      48px, fill weight, icon-minimal — the export's own #cac2bf
//   caption   body-md / text-subtle — names the state in one short phrase.
//             A node rather than a string, since a caption is not always a
//             plain line of text: some screens name their state with a badge
//             (Connections' "1 connection active" pill) and some carry a bold
//             fragment (Content's search echoes the query back that way).
//             Anything passed inherits the caption's own type styles unless it
//             sets its own.
//   title     heading-sm / Phudu — the substantive message, and the loudest
//             thing on screen despite sitting under a smaller label
//
// The caption/title inversion is deliberate on the design's part: the small
// grey line says *what* this is, the big line says what it means or what to do.
//
// `action` is optional and hugs its content — these buttons are never
// full-width, unlike the ones inside cards and forms.
//
// `size="sm"` is the same three pieces at the scale the
// EmptyDashboardPostSection export draws them: a 32px icon, dist-md between
// the pieces, and a title-lg title instead of the page-sized heading-sm. It
// exists because that export puts this layout *inside* a 200px tray rather
// than on a blank page — the full-size one doesn't fit, and inventing a second
// component for the same three pieces in the same order would let the two
// drift.
const SIZES = {
  md: { icon: "size-12", gap: "gap-dist-lg", title: "text-heading-sm" },
  sm: { icon: "size-8", gap: "gap-dist-md", title: "text-title-lg" },
} as const

export function EmptyState({
  icon: EmptyIcon,
  caption,
  title,
  action,
  size = "md",
  className,
}: {
  icon: Icon
  caption: React.ReactNode
  title: string
  action?: React.ReactNode
  size?: keyof typeof SIZES
  className?: string
}) {
  const scale = SIZES[size]
  // The full-size layout *is* the page, so its title is the page's h1. The
  // compact one sits inside a tray under a heading of its own (the Next-up
  // column's "Next up . . ."), where a second h1 would be wrong — it's a
  // paragraph that happens to be the loudest thing in its box.
  const Title = size === "md" ? "h1" : "p"

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center",
        scale.gap,
        className
      )}
    >
      <EmptyIcon weight="bold" className={cn(scale.icon, "text-icon-minimal")} />
      {/* Both text blocks are a fixed 272px in the export rather than fluid,
          which is what gives the title its deliberate 3-4 line wrap. */}
      <p className="w-68 text-center text-body-md text-text-subtle">{caption}</p>
      <div className="flex flex-col items-center gap-dist-xl">
        {/* font-display (Phudu) renders caps on its own — no `uppercase`. */}
        <Title
          className={cn(
            "w-68 text-center font-display text-text-bold",
            scale.title
          )}
        >
          {title}
        </Title>
        {action}
      </div>
    </div>
  )
}
