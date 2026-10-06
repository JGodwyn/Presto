import * as React from "react"

import {
  definePixelGradient,
  PixelGradient,
} from "@/components/shared/pixel-gradient"

// The onboarding cover's full-screen artwork (see pixel-gradient.tsx for how
// it's drawn), replacing /images/onboarding/cover-gradient.webp (since
// deleted): violet columns rising from the bottom edge, tallest in the middle
// and stepping down to either side, fading through pink to white with a dot
// halo above each. The same design as the green glow (glow-gradient.tsx), in
// purple and filling the screen.
//
// Colours are sampled from that image — 32 points up each column over its
// full 2048px height, where the colour runs out — and the halo reaches are
// where each column's dots end, measured the same way. Unlike the glow, the
// hue drifts with height (violet → pink), so this keeps the sampled colours
// rather than a single token ink. Columns are in the image's 2880px width.
const ART_WIDTH = 2880
const ART_HEIGHT = 2048

const ART = definePixelGradient({
  orientation: "columns",
  extent: [0, ART_WIDTH],
  samples: 32,
  // The image's halftone: bold square dots on a ~4px pitch — deep violet
  // through the colour, periwinkle (the halo) above it where the colour has
  // thinned — with only faint grid lines between. Tuned beside the original
  // at 2×.
  texture: {
    pitch: 4,
    gridLine: 0.5,
    gridOpacity: 0.12,
    grainOpacity: 0.6,
    grainDot: 0.55,
    grainDepth: 1.8,
    grainColor: "#9a74ee",
    fringeStretch: 1.4,
    fringeOpacity: 0.9,
    haloColor: "#b4b0f7",
    haloDot: 0.5,
    haloDensity: [0.55, 0.15],
  },
  bands: [
    { start: 0, end: 184, halo: 944 / ART_HEIGHT, colors: ["#ba22dc", "#c748e3", "#d363e9", "#df7bf1", "#ea92f6", "#f3a6fb", "#f6b4fc", "#f7c2fd", "#f7cffc", "#f7dcfc", "#f8e9fc", "#f9f3fc", "#fbf8fd", "#ffffff"] },
    { start: 184, end: 338, halo: 1104 / ART_HEIGHT, colors: ["#ba1edc", "#c441e1", "#ce59e7", "#d96fed", "#e382f3", "#eb94f7", "#f3a6fb", "#f6b1fc", "#f7bdfd", "#f7c8fd", "#f7d3fc", "#f6dffb", "#f7eafc", "#f9f2fc", "#faf6fd", "#fcfafe", "#ffffff"] },
    { start: 338, end: 501, halo: 1296 / ART_HEIGHT, colors: ["#ba1bdb", "#c23ce0", "#cb52e6", "#d566ea", "#dd78f0", "#e688f4", "#ee99f8", "#f3a7fb", "#f6b1fc", "#f7bbfd", "#f7c4fd", "#f7cefc", "#f7d8fc", "#f6e2fb", "#f7ecfc", "#f8f2fc", "#faf6fd", "#fbf8fd", "#ffffff"] },
    { start: 501, end: 684, halo: 1472 / ART_HEIGHT, colors: ["#b919da", "#c038df", "#c84ce3", "#d15de8", "#d86eed", "#e07df1", "#e88cf5", "#ee9af8", "#f3a7fb", "#f5b0fc", "#f7b9fd", "#f7c1fd", "#f7c9fc", "#f7d2fc", "#f7dbfb", "#f7e3fb", "#f8edfc", "#f8f2fc", "#faf5fd", "#fbf7fd", "#fcfafd", "#ffffff"] },
    { start: 684, end: 881, halo: 1632 / ART_HEIGHT, colors: ["#b917db", "#bf34df", "#c647e2", "#ce58e6", "#d566eb", "#db74ef", "#e281f3", "#e98ef5", "#ef9bf9", "#f3a6fb", "#f6affc", "#f7b6fd", "#f8befd", "#f7c5fd", "#f8ccfc", "#f7d5fc", "#f7ddfb", "#f7e4fb", "#f8ecfc", "#f8f2fc", "#f9f4fd", "#fbf6fd", "#fcf8fd", "#fcfafe", "#ffffff"] },
    { start: 881, end: 1094, halo: 1872 / ART_HEIGHT, colors: ["#b815da", "#be30de", "#c442e1", "#cb51e5", "#d15ee8", "#d86bec", "#dd78f0", "#e384f2", "#e98ff6", "#ee9bf8", "#f3a5fb", "#f5acfc", "#f6b4fc", "#f7bafd", "#f7c1fd", "#f8c8fd", "#f8cefc", "#f7d6fc", "#f7dcfb", "#f6e3fb", "#f7eafc", "#f8f0fc", "#f9f3fc", "#f9f4fd", "#fbf7fd", "#fbf9fd", "#fcfafd", "#ffffff"] },
    { start: 1094, end: 1786, halo: 2048 / ART_HEIGHT, colors: ["#b813da", "#bd2ddd", "#c23ee0", "#c84ce3", "#ce58e6", "#d464e9", "#da6fee", "#de7af0", "#e484f3", "#e98ff6", "#ee99f8", "#f2a2fa", "#f4aafc", "#f5b0fc", "#f7b6fd", "#f7bcfd", "#f7c2fd", "#f7c8fd", "#f7cdfc", "#f7d5fc", "#f7dafb", "#f6e0fb", "#f7e7fb", "#f7edfc", "#f8f1fc", "#f9f2fc", "#f9f4fd", "#faf5fd", "#fbf8fd", "#fcf9fd", "#fcfafe", "#ffffff"] },
    { start: 1786, end: 1999, halo: 1872 / ART_HEIGHT, colors: ["#b815da", "#be31dd", "#c442e1", "#cb51e4", "#d15fe8", "#d86bec", "#dd78f0", "#e384f2", "#e98ff6", "#ee9af8", "#f3a5fb", "#f5acfc", "#f6b4fc", "#f8bafd", "#f7c1fd", "#f7c8fd", "#f7cefc", "#f7d6fc", "#f7dcfb", "#f6e3fb", "#f7eafc", "#f8f0fc", "#f9f3fc", "#faf4fd", "#fbf7fd", "#fbf9fd", "#fcfafd", "#ffffff"] },
    { start: 1999, end: 2196, halo: 1632 / ART_HEIGHT, colors: ["#b917da", "#bf34de", "#c647e2", "#cd56e6", "#d466ea", "#db73ee", "#e281f2", "#e88ef5", "#ef9bf8", "#f3a6fb", "#f5aefc", "#f7b6fd", "#f8befd", "#f8c5fd", "#f8ccfc", "#f7d5fc", "#f7ddfb", "#f7e4fb", "#f7ecfc", "#f8f1fc", "#f9f4fc", "#fbf6fd", "#fcf8fd", "#fcfafe", "#ffffff"] },
    { start: 2196, end: 2379, halo: 1472 / ART_HEIGHT, colors: ["#b919db", "#c038df", "#c84ce4", "#d15ee8", "#d86eed", "#e07ef1", "#e88cf5", "#ee9af8", "#f3a7fb", "#f5b0fc", "#f8b9fd", "#f7c1fd", "#f7c9fc", "#f7d2fc", "#f6dbfb", "#f6e4fb", "#f8edfc", "#f8f2fc", "#faf5fd", "#fbf7fd", "#fcf9fd", "#ffffff"] },
    { start: 2379, end: 2542, halo: 1296 / ART_HEIGHT, colors: ["#ba1bdb", "#c23de0", "#cb52e6", "#d465ea", "#dd78f0", "#e588f4", "#ee98f9", "#f3a7fb", "#f6b1fc", "#f7bbfd", "#f8c5fd", "#f7cefc", "#f7d8fc", "#f6e2fb", "#f7edfc", "#f8f2fc", "#faf6fd", "#fbf8fd", "#ffffff"] },
    { start: 2542, end: 2696, halo: 1104 / ART_HEIGHT, colors: ["#ba1edc", "#c542e1", "#ce5ae7", "#d96fed", "#e382f3", "#ec95f7", "#f3a6fb", "#f6b2fc", "#f8bdfd", "#f8c8fd", "#f7d3fc", "#f7defb", "#f8eafc", "#f9f3fc", "#fbf6fd", "#fcfafe", "#ffffff"] },
    { start: 2696, end: 2880, halo: 944 / ART_HEIGHT, colors: ["#bb22dc", "#c748e3", "#d464ea", "#df7cf1", "#eb93f7", "#f3a6fb", "#f6b4fc", "#f7c2fd", "#f7cffc", "#f7dcfc", "#f8e9fc", "#f9f3fd", "#fbf8fd", "#ffffff"] },
  ],
})

export function OnboardingCoverGradient({ className }: { className?: string }) {
  return <PixelGradient art={ART} className={className} />
}
