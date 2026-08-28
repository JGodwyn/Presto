"use client"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"

// Figma --rad-lg as px for the squircle path math — see
// hooks/use-squircle-clip-path.ts.
const ROW_CORNER_RADIUS = 16

// A plain, non-expanding row of the Profile menu (Figma "ProfileScreen"):
// 312×40 surface-4 card, icon + bold label, nothing trailing it.
//
// **Nothing trailing it is the point.** The export draws a dotted rule and a
// caret on the rows that open something and omits both here, because this one
// acts in place — so a row that leads somewhere is a ProfileDisclosure, and
// this shape is reserved for rows that just do the thing.
export function ProfileRow({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: React.ElementType
  label: string
  onClick?: () => void
  className?: string
}) {
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: ROW_CORNER_RADIUS,
  })

  return (
    <button
      ref={ref}
      style={style}
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-pad-3xl w-full cursor-pointer items-center gap-dist-lg rounded-rad-lg bg-surface-4 py-pad-sm pr-pad-sm pl-pad-md text-left transition-[background-color,scale] duration-150 ease-out hover:bg-surface-2 active:scale-[0.98]",
        className
      )}
    >
      <span className="flex shrink-0 items-center gap-dist-md">
        <Icon weight="bold" className="size-5 text-icon-subtle" />
        <span className="text-body-lg-bold text-text-bold">{label}</span>
      </span>
    </button>
  )
}
