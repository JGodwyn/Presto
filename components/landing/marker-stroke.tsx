import * as React from "react"

import { cn } from "@/lib/utils"

function markerStrokePath(roughness: number) {
  const amount = Math.max(0, Math.min(1.5, roughness))
  const point = (base: number, variation: number) =>
    Math.max(1, Math.min(99, base + variation * amount)).toFixed(2)

  return [
    `M7 ${point(8, -1)}`,
    `C${point(4, -1)} 12 ${point(3, -1)} 28 ${point(3, -1)} 45`,
    `C${point(3, -1)} 59 ${point(2, -2)} 76 ${point(2, -1)} 86`,
    "C2 96 4 97 8 97H48",
    `C59 ${point(94, 3)} 67 ${point(94, -2)} 73 ${point(94, -6)}`,
    `C79 ${point(94, -8)} 81 ${point(94, 0)} 87 ${point(94, 3)}`,
    `C93 ${point(94, 6)} 98 ${point(94, 3)} 99 86`,
    "C100 76 98 64 99 53C100 39 100 20 98 10",
    `C97 ${point(8, -4)} 94 ${point(8, 0)} 91 ${point(8, 2)}`,
    `C83 ${point(8, 2)} 77 ${point(8, 0)} 72 ${point(8, -4)}`,
    `C66 ${point(8, -9)} 62 ${point(8, -4)} 55 ${point(8, -2)}`,
    `C44 ${point(8, 1)} 31 8 20 8L7 ${point(8, -1)}Z`,
  ].join("")
}

function MarkerStroke({
  roughness,
  className,
  ...props
}: React.ComponentProps<"svg"> & { roughness: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("absolute inset-0 size-full", className)}
      {...props}
    >
      <path fill="currentColor" d={markerStrokePath(roughness)} />
    </svg>
  )
}

export { MarkerStroke }
