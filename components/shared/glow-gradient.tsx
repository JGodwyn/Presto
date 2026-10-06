import * as React from "react"

import {
  definePixelGradient,
  PixelGradient,
} from "@/components/shared/pixel-gradient"

// The green pixel glow on Generate and Content (see pixel-gradient.tsx for how
// it's drawn), replacing the deleted /images/generate/pixel-glow.webp: green columns
// rising from the bottom edge, tallest in the middle and stepping down to
// either side. Colours are sampled from that image — 32 points up each
// column, over its bottom half (the top half was plain white and is dropped).
// Each column's colour stops at its first neutral-grey sample: those come
// from the image's grey paper-dots averaging out, and drawn solid they read as
// a grey wash. The dots themselves are drawn as each column's `halo`, with
// reaches measured from the image (the outermost two columns are halo only).
// Columns are in its 1840px-wide pixel space, which is kept whole: the empty
// margins either side are part of how the art sits in the panel.
const ART_WIDTH = 1840
const ART_HEIGHT = 492

const ART = definePixelGradient({
  orientation: "columns",
  extent: [0, ART_WIDTH],
  samples: 32,
  // One ink (design tokens) rather than the sampled greens: bolder and more
  // saturated than the image, by request, and without the grey cast its
  // near-white samples carried. The samples still decide how much ink goes
  // where.
  ink: { color: "var(--lime-200)", grain: "var(--lime-400)", depth: 1.15 },
  // Coarser and much grainier than the sidebar: the export's dots sit on a
  // ~4px grid at the panel's usual desktop width (the image scaled with the
  // panel; this holds the desktop size), with darker grain through the green
  // and a grey dot halo above each column. Tuned side by side against the
  // original at 1×.
  texture: {
    pitch: 4,
    gridLine: 0.6,
    gridOpacity: 0.45,
    grainOpacity: 0.35,
    fringeStretch: 1.35,
    fringeOpacity: 1,
    haloColor: "#b0b0b0",
    haloDensity: [0.7, 0.3],
  },
  bands: [
    { start: 260, end: 355, colors: ["#ffffff"], halo: 48 / ART_HEIGHT },
    { start: 355, end: 450, colors: ["#ebf7eb", "#f4f8f3", "#ffffff"], halo: 96 / ART_HEIGHT },
    { start: 450, end: 548, colors: ["#cdf5cb", "#d9f6d8", "#e5f7e4", "#eef7ee", "#ffffff"], halo: 136 / ART_HEIGHT },
    { start: 548, end: 650, colors: ["#a9f3a5", "#b6f4b1", "#c3f5bf", "#cff6ca", "#dbf7d9", "#e5f6e3", "#eff7ed", "#ffffff"], halo: 193 / ART_HEIGHT },
    { start: 650, end: 755, colors: ["#84f17f", "#92f28c", "#9ff39a", "#adf5a8", "#b8f5b3", "#c3f5bf", "#cff6cb", "#dbf6d8", "#e5f7e3", "#ecf7eb", "#f4f8f3", "#ffffff"], halo: 241 / ART_HEIGHT },
    { start: 755, end: 1080, colors: ["#6def65", "#7df174", "#8df283", "#99f390", "#a6f49e", "#b0f3a8", "#bcf5b6", "#c7f5c1", "#d1f6cc", "#ddf6d9", "#e6f6e4", "#eef7ec", "#f4f7f3", "#ffffff"], halo: 280 / ART_HEIGHT },
    { start: 1080, end: 1185, colors: ["#8bf17c", "#96f288", "#a3f499", "#b0f5a6", "#bbf5b1", "#c6f5be", "#d0f6c9", "#dcf6d7", "#e5f7e3", "#edf7eb", "#f3f8f2", "#ffffff"], halo: 241 / ART_HEIGHT },
    { start: 1185, end: 1288, colors: ["#adf3a2", "#b8f4ae", "#c5f6bc", "#d0f6c9", "#dcf6d8", "#e6f6e3", "#eff7ed", "#ffffff"], halo: 193 / ART_HEIGHT },
    { start: 1288, end: 1385, colors: ["#d1f5c7", "#dcf6d5", "#e6f7e2", "#eff8ed", "#ffffff"], halo: 136 / ART_HEIGHT },
    { start: 1385, end: 1480, colors: ["#edf7ea", "#f4f8f3", "#ffffff"], halo: 96 / ART_HEIGHT },
    { start: 1480, end: 1575, colors: ["#ffffff"], halo: 48 / ART_HEIGHT },
  ],
})

// Natural proportions of the drawn region.
export const GLOW_GRADIENT_ASPECT = `${ART_WIDTH} / ${ART_HEIGHT}`

export function GlowGradient({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <PixelGradient art={ART} className={className} style={style} />
}
