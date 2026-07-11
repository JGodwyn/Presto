"use client"

import * as React from "react"
import { getSvgPath } from "figma-squircle"

interface UseSquircleClipPathOptions {
  cornerRadius: number
  // Figma's corner-smoothing slider goes 0-100%; figma-squircle takes 0-1.
  cornerSmoothing?: number
}

// Figma's "corner smoothing" produces a continuous squircle curve that plain
// CSS border-radius can't reproduce. The generated path depends on the
// element's actual rendered pixel size (not just its radius), so it can't be
// expressed as a static CSS class — it has to be measured and recomputed
// whenever the element resizes.
function useSquircleClipPath<T extends HTMLElement>({
  cornerRadius,
  cornerSmoothing = 1,
}: UseSquircleClipPathOptions) {
  const [clipPath, setClipPath] = React.useState<string>()
  const observerRef = React.useRef<ResizeObserver | null>(null)

  // A callback ref rather than useRef+useEffect: elements that only mount
  // once some other condition becomes true (e.g. Base UI's DialogPortal
  // renders null until the dialog opens) attach to the DOM well after this
  // hook's owning component already committed once with a null ref. Since
  // cornerRadius/cornerSmoothing don't change when the dialog later opens,
  // a dependency-array effect never gets a second chance to see the real
  // node. A callback ref instead fires every time React actually
  // attaches/detaches the node, whenever that happens.
  const ref = React.useCallback(
    (element: T | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (!element) return

      const observer = new ResizeObserver(([entry]) => {
        // clip-path's default reference box is the border-box, but
        // entry.contentRect measures the content-box (excludes
        // padding/border) — using it here would generate a path smaller
        // than the element actually painting, clipping off a ring around
        // the edges wherever the element has padding.
        const borderBoxSize = Array.isArray(entry.borderBoxSize)
          ? entry.borderBoxSize[0]
          : entry.borderBoxSize
        const width = borderBoxSize.inlineSize
        const height = borderBoxSize.blockSize
        if (width === 0 || height === 0) return
        setClipPath(
          `path('${getSvgPath({ width, height, cornerRadius, cornerSmoothing })}')`
        )
      })
      observer.observe(element, { box: "border-box" })
      observerRef.current = observer
    },
    [cornerRadius, cornerSmoothing]
  )

  return { ref, style: clipPath ? { clipPath } : undefined }
}

export { useSquircleClipPath }
