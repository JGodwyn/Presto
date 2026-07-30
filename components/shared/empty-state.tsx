import type { Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

// The app's one empty/blank-page layout, from the Figma "Empty state" export
// (design-sync/empty-state). Three stacked pieces, centred in whatever space
// they're given:
//
//   icon      48px, fill weight, icon-minimal — the export's own #cac2bf
//   caption   body-md / text-subtle — names the state in one short phrase
//   title     heading-sm / Phudu — the substantive message, and the loudest
//             thing on screen despite sitting under a smaller label
//
// The caption/title inversion is deliberate on the design's part: the small
// grey line says *what* this is, the big line says what it means or what to do.
//
// `action` is optional and hugs its content — these buttons are never
// full-width, unlike the ones inside cards and forms.
export function EmptyState({
  icon: EmptyIcon,
  caption,
  title,
  action,
  className,
}: {
  icon: Icon
  caption: string
  title: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-dist-lg",
        className
      )}
    >
      <EmptyIcon weight="bold" className="size-12 text-icon-minimal" />
      {/* Both text blocks are a fixed 272px in the export rather than fluid,
          which is what gives the title its deliberate 3-4 line wrap. */}
      <p className="w-68 text-center text-body-md text-text-subtle">{caption}</p>
      <div className="flex flex-col items-center gap-dist-xl">
        {/* font-display (Phudu) renders caps on its own — no `uppercase`. */}
        <h1 className="w-68 text-center text-heading-sm font-display text-text-bold">
          {title}
        </h1>
        {action}
      </div>
    </div>
  )
}
