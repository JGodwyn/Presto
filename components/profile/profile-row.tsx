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
  tone = "default",
  className,
}: {
  icon: React.ElementType
  label: string
  onClick?: () => void
  // "danger" is for the one destructive row (Delete project): red icon and
  // label, same treatment Menu gives its danger items.
  tone?: "default" | "danger"
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
        "flex h-pad-3xl w-full cursor-pointer items-center gap-dist-lg rounded-rad-lg bg-surface-4 py-pad-sm pr-pad-sm pl-pad-md text-left transition-[background-color,scale] duration-150 ease-out hover:bg-surface-2 active:scale-[0.98] max-md:h-pad-4xl",
        className
      )}
    >
      <span className="flex shrink-0 items-center gap-dist-md">
        <Icon
          weight="bold"
          className={cn(
            "size-5",
            tone === "danger" ? "text-icon-danger" : "text-icon-subtle"
          )}
        />
        <span
          className={cn(
            "text-body-lg-bold",
            tone === "danger" ? "text-text-danger" : "text-text-bold"
          )}
        >
          {label}
        </span>
      </span>
    </button>
  )
}
