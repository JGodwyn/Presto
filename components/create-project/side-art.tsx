import * as React from "react"

// One side of the /create-project backdrop, drawn in code, replacing
// /images/create-project/background.webp (since deleted). The art is a stepped diamond
// pressed against the screen edge, built entirely from vertical bars, in four
// layers (back to front):
//
//   light  — a faint outer shell, the widest
//   dashed — stronger bars broken into dashes, many missing (the light shell
//            shows through the gaps)
//   ridge  — a band of nearly-unbroken dashes near the dashed layer's outer
//            edge, across the middle steps only
//   core   — solid bars right at the edge
//
// Every layer steps out on the same rows, widest across the middle of the
// screen. Colour runs top to bottom: pink, violet, then periwinkle. Spans and
// colours are measured from the original image (16px cells; the colours are
// sampled hex because the palette has no pink or blue tokens — the same
// literal-hex exception as components/shared/pixel-gradient.tsx).
//
// Geometry follows the box, texture doesn't: step rows are percentages of the
// height and spans percentages of the width, while the bars and dashes sit on
// a fixed 8px grid (the original's pitch on a typical desktop) so they stay
// crisp at any size. No viewBox, for the same reason as PixelGradient.

export type SideArtLayer =
  | "fade4"
  | "fade3"
  | "fade2"
  | "fade1"
  | "light"
  | "dashed"
  | "ridge"
  | "core"

// Back to front. The fades are the light shell dissolving into dither at its
// outer edge — they belong to it, and reveal with it (see
// CreateProjectBackdrop).
export const SIDE_ART_LAYERS: SideArtLayer[] = [
  "fade4",
  "fade3",
  "fade2",
  "fade1",
  "light",
  "dashed",
  "ridge",
  "core",
]

// The image's 2048px height, in its 16px cells, and where each step starts on
// that grid (the last entry closes the final step). Symmetric about the
// middle: seven steps in, a tall peak, seven steps out.
const ROWS = 128
const STEP_ROWS = [0, 6, 11, 18, 25, 32, 41, 49, 79, 87, 95, 102, 109, 116, 121, 128]
// The art's full width, in cells: the light shell's 51-cell peak plus the
// dither it dissolves into past that.
const FULL_WIDTH = 56
// Where the shell's outer edge lands per step, in cells — the original's
// hard edge. The dither straddles it: the shell's own last cells thin out,
// and sparser bars carry on a few cells past.
const SHELL_ENDS = [13, 17, 22, 27, 33, 39, 45, 51, 45, 39, 33, 27, 22, 17, 13]
// [start, end] relative to SHELL_ENDS, and the share of dashes missing —
// four bands, each sparser than the last.
const FADES = [
  { from: -3, to: -1, dropout: 0.25, seed: 0xfad1 },
  { from: -1, to: 1, dropout: 0.5, seed: 0xfad2 },
  { from: 1, to: 3, dropout: 0.72, seed: 0xfad3 },
  { from: 3, to: 5, dropout: 0.88, seed: 0xfad4 },
]

type Span = [start: number, end: number] | null

type LayerSpec = {
  // Per step, in cells from the screen edge.
  spans: Span[]
  colors: [offset: number, color: string][]
  // Share of dashes missing, and the seed that picks which. 0 = solid bars.
  dropout: number
  seed: number
  // A seeded share of cells drawn again in a deeper ramp — the original's
  // dashes vary in strength cell by cell, which is most of its texture.
  accent?: { share: number; seed: number; colors: [offset: number, color: string][] }
}

const to = (ends: number[]): Span[] => ends.map((end) => [0, end])

const LIGHT_COLORS: [number, string][] = [
  [0, "#f9dcef"],
  [0.5, "#f2dcf9"],
  [1, "#e6e8fb"],
]

const fade = (index: number): LayerSpec => {
  const { from, to: until, dropout, seed } = FADES[index]
  return {
    spans: SHELL_ENDS.map((end) => [end + from, end + until]),
    colors: LIGHT_COLORS,
    dropout,
    seed,
  }
}

const LAYERS: Record<SideArtLayer, LayerSpec> = {
  // Solid up to where the dither takes over.
  light: {
    spans: to(SHELL_ENDS.map((end) => end + FADES[0].from)),
    colors: LIGHT_COLORS,
    dropout: 0,
    seed: 0,
  },
  fade1: fade(0),
  fade2: fade(1),
  fade3: fade(2),
  fade4: fade(3),
  dashed: {
    spans: to([4, 7, 10, 14, 19, 24, 28, 33, 28, 24, 19, 14, 10, 7, 4]),
    colors: [
      [0, "#f4a6d8"],
      [0.25, "#ec9fe4"],
      [0.5, "#e1a6f2"],
      [0.75, "#ccb2f7"],
      [1, "#b9c0f6"],
    ],
    dropout: 0.3,
    seed: 0x5eed,
    accent: {
      share: 0.3,
      seed: 0xacce,
      colors: [
        [0, "#ef7fcd"],
        [0.3, "#e07ee8"],
        [0.55, "#cd8cf3"],
        [0.8, "#b39ef6"],
        [1, "#9fb0f6"],
      ],
    },
  },
  ridge: {
    spans: [
      null, null, null, null,
      [15, 19], [16, 23], [16, 26], [16, 27], [16, 26], [16, 23], [15, 19],
      null, null, null, null,
    ],
    colors: [
      [0.2, "#f1b6eb"],
      [0.45, "#e9b6f4"],
      [0.65, "#dcbef9"],
      [0.85, "#d3c6f9"],
    ],
    dropout: 0.08,
    seed: 0x1d6e,
  },
  core: {
    spans: to([6, 7, 8, 9, 11, 12, 13, 14, 13, 12, 11, 9, 8, 7, 6]),
    colors: [
      [0, "#f8b0db"],
      [0.25, "#ee90e2"],
      [0.45, "#e99ced"],
      [0.62, "#daa0f8"],
      [0.8, "#c3aaf9"],
      [1, "#c3cdf8"],
    ],
    dropout: 0,
    seed: 0,
    accent: {
      share: 0.06,
      seed: 0xc0de,
      colors: [
        [0, "#ea5fc4"],
        [0.3, "#dd6fe6"],
        [0.6, "#c47ff4"],
        [1, "#a9b4f6"],
      ],
    },
  },
}

// The bar grid, in CSS px: an 8px pitch, 5.5px bars, 2.5px gaps. Dashed
// layers draw one bar segment per cell, a hair short so neighbours separate.
const PITCH = 8
const BAR = 5.5
// Dropouts repeat on a 16×16-cell tile (128px square) — too big to read as a
// repeat, small enough to keep the pattern cheap.
const TILE = 16

// Which cells of the tile are missing. A plain seeded LCG, so server and
// client draw the same art.
function droppedCells(dropout: number, seed: number) {
  const cells: boolean[] = []
  let state = seed
  for (let i = 0; i < TILE * TILE; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    cells.push(state / 0x7fffffff < dropout)
  }
  return cells
}

// Same shape, opposite sense: which cells are picked for the accent.
const ACCENTED = Object.fromEntries(
  SIDE_ART_LAYERS.map((layer) => {
    const accent = LAYERS[layer].accent
    return [layer, accent ? droppedCells(accent.share, accent.seed) : null]
  })
) as Record<SideArtLayer, boolean[] | null>

const DROPPED = Object.fromEntries(
  SIDE_ART_LAYERS.map((layer) => [
    layer,
    droppedCells(LAYERS[layer].dropout, LAYERS[layer].seed),
  ])
) as Record<SideArtLayer, boolean[]>

const percent = (fraction: number) => `${fraction * 100}%`

// A step's span as SVG rect attributes.
function stepRect([start, end]: [number, number], step: number) {
  return {
    x: percent(start / FULL_WIDTH),
    y: percent(STEP_ROWS[step] / ROWS),
    width: percent((end - start) / FULL_WIDTH),
    height: percent((STEP_ROWS[step + 1] - STEP_ROWS[step]) / ROWS),
  }
}

export function SideArt({
  layer,
  className,
}: {
  layer: SideArtLayer
  className?: string
}) {
  const uid = `side-art-${layer}-${React.useId().replace(/[^\w-]/g, "")}`
  const spec = LAYERS[layer]
  const dashed = spec.dropout > 0

  return (
    <svg aria-hidden className={className} width="100%" height="100%">
      <defs>
        <linearGradient
          id={`${uid}-color`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2="100%"
        >
          {spec.colors.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>

        <pattern
          id={`${uid}-bars`}
          patternUnits="userSpaceOnUse"
          width={dashed ? PITCH * TILE : PITCH}
          height={dashed ? PITCH * TILE : PITCH}
        >
          {dashed ? (
            DROPPED[layer].map((dropped, cell) =>
              dropped ? null : (
                <rect
                  key={cell}
                  x={(cell % TILE) * PITCH}
                  y={Math.floor(cell / TILE) * PITCH}
                  width={BAR}
                  height={PITCH - 0.5}
                  fill="white"
                />
              )
            )
          ) : (
            <rect width={BAR} height={PITCH} fill="white" />
          )}
        </pattern>
        <mask id={`${uid}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${uid}-bars)`} />
        </mask>

        {spec.accent ? (
          <>
            <linearGradient
              id={`${uid}-accent-color`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2="100%"
            >
              {spec.accent.colors.map(([offset, color]) => (
                <stop key={offset} offset={offset} stopColor={color} />
              ))}
            </linearGradient>
            <pattern
              id={`${uid}-accent-cells`}
              patternUnits="userSpaceOnUse"
              width={PITCH * TILE}
              height={PITCH * TILE}
            >
              {ACCENTED[layer]?.map((picked, cell) =>
                picked ? (
                  <rect
                    key={cell}
                    x={(cell % TILE) * PITCH}
                    y={Math.floor(cell / TILE) * PITCH}
                    width={BAR}
                    height={PITCH - 0.5}
                    fill="white"
                  />
                ) : null
              )}
            </pattern>
            <mask id={`${uid}-accent-mask`}>
              <rect
                width="100%"
                height="100%"
                fill={`url(#${uid}-accent-cells)`}
              />
            </mask>
          </>
        ) : null}

        {/* The fine checker inside each bar in the original. */}
        <pattern
          id={`${uid}-checker`}
          patternUnits="userSpaceOnUse"
          width="2"
          height="2"
        >
          <rect width="1" height="1" fill="white" />
          <rect x="1" y="1" width="1" height="1" fill="white" />
        </pattern>
      </defs>

      <g mask={`url(#${uid}-mask)`}>
        {spec.spans.map((span, step) =>
          span ? (
            <rect
              key={step}
              {...stepRect(span, step)}
              fill={`url(#${uid}-color)`}
              shapeRendering="crispEdges"
            />
          ) : null
        )}
        <rect
          width="100%"
          height="100%"
          fill={`url(#${uid}-checker)`}
          opacity={0.18}
        />
      </g>

      {spec.accent ? (
        <g mask={`url(#${uid}-accent-mask)`}>
          {spec.spans.map((span, step) =>
            span ? (
              <rect
                key={step}
                {...stepRect(span, step)}
                fill={`url(#${uid}-accent-color)`}
                shapeRendering="crispEdges"
              />
            ) : null
          )}
        </g>
      ) : null}
    </svg>
  )
}
