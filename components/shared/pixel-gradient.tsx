import * as React from "react"

import { cn } from "@/lib/utils"

// The app's pixel-gradient artwork, drawn in code. Two pieces of art use it —
// the sidebar's staircase (sidebar-gradient.tsx) and the green glow on
// Generate and Content (glow-gradient.tsx) — and they're the same design
// turned 90°: a row of bands, each fading from a deep colour to white, every
// band reaching a different distance. Three layers make the look:
//
//   1. Bands — each a gradient along the fade axis, from colours sampled out
//      of the original exported artwork.
//   2. Fringe — past where each band fades out, its colour carries on as a
//      dithered dot field, thinning to nothing. This is
//      what gives each step its dotted, pixel-y edge instead of a soft fade.
//   3. Grid — a faint 2px light grid over everything, the printed-paper
//      texture. The bands are darkened by exactly what the grid lightens, so
//      the average colour still matches the original.
//
// Why code rather than the images: a raster scales as one piece, so its dots
// blurred or shrank with the container and its aspect couldn't give. Here the
// band geometry is in percentages of whatever box the SVG is given, while the
// dots and grid are in real CSS pixels — crisp at any size or pixel ratio, and
// a box with a different aspect moves the bands without stretching the dots.
// (So there's deliberately no viewBox.)
//
// The colours are sampled, not invented — the same literal-hex exception as
// the images they replace and TexturedGradient.

export type PixelGradientBand = {
  // Position along the band axis, in the source artwork's pixels.
  start: number
  end: number
  // Sampled from the band's deep end towards its light end, evenly spaced
  // over `samples` slots. Trailing white can be left off: the last colour is
  // held to the end.
  colors: string[]
  // How far up the fade axis (0–1, from the deep end) this band's grey
  // paper-dot halo reaches, past where its colour runs out. Omit for none.
  halo?: number
}

// Per-artwork texture. The sidebar was exported at 2× and reads fine with a
// fine, quiet texture; the glow's export is coarser and much grainier.
export type PixelGradientTexture = {
  // Dot / grid cell size, and the grid's line width, in CSS px.
  pitch: number
  gridLine: number
  gridOpacity: number
  // Darker dots of the band's own colour scattered through it — the grain:
  // how strongly they show, their size as a share of the cell, and how much
  // further from white than the band they sit (1 = the band's own colour).
  grainOpacity: number
  grainDot: number
  grainDepth: number
  // Optional fixed grain hue, for art whose dots differ in hue from the
  // colour around them (the onboarding cover's bluish dots on pink). Laid at
  // each sample's share of the band's ink, so it fades out with the band.
  // `grainDepth` is ignored when this is set.
  grainColor?: string
  // How far each band's dithered fringe trails past its solid fade, as a
  // multiple of the fade axis, and how strongly it shows.
  fringeStretch: number
  fringeOpacity: number
  haloColor: string
  // Halo dot size as a share of the cell.
  haloDot: number
  // Halo dot density at its densest (bottom) and at its top edge.
  haloDensity: [number, number]
}

export type PixelGradientSpec = {
  // "rows": bands stacked top to bottom, fading left → right (the sidebar).
  // "columns": bands side by side, fading bottom → top (the glow).
  orientation: "rows" | "columns"
  // The stretch of the band axis the SVG box represents.
  extent: [number, number]
  samples: number
  bands: PixelGradientBand[]
  texture?: Partial<PixelGradientTexture>
  // Draw every band in one ink instead of its sampled colours: each sample
  // keeps only *how much* ink it carries (relative to the artwork's deepest
  // sample), laid down as `color` at that opacity. Removes the greyish tint
  // the sampled near-whites carry, and lets the colour be a design token.
  // `depth` > 1 makes it bolder — the fade reaches further before whitening.
  ink?: { color: string; grain: string; depth: number }
}

const DEFAULT_TEXTURE: PixelGradientTexture = {
  pitch: 2,
  gridLine: 0.5,
  gridOpacity: 0.22,
  grainOpacity: 0,
  fringeStretch: 1.45,
  fringeOpacity: 0.7,
  haloColor: "#bdbdbd",
  haloDensity: [0.35, 0.05],
  grainDot: 0.45,
  grainDepth: 2.2,
  haloDot: 0.4,
}

// Dot sizes as a share of the cell (2px pitch → 1.5px dither dots on the
// sidebar).
const DOT_SHARE = 0.75
// How finely the fringe and halo are resolved along the fade axis.
const FRINGE_CELLS = 48
const DITHER_LEVELS = 16
// Dither thresholds for an 8×8 tile: the standard 8×8 Bayer matrix. Ordered
// dithering keeps the dots evenly spread (a random tile clumps, and its 8×8
// repeat shows); at 8×8 its pattern reads as an even crosshatch, where a 4×4
// matrix's diagonals read as stripes at these densities.
const DITHER_TILE = 8
const DITHER_THRESHOLDS = (() => {
  let matrix = [[0]]
  while (matrix.length < DITHER_TILE) {
    const n = matrix.length
    const next: number[][] = Array.from({ length: n * 2 }, () => [])
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = matrix[y][x] * 4
        next[y][x] = v
        next[y][x + n] = v + 2
        next[y + n][x] = v + 3
        next[y + n][x + n] = v + 1
      }
    }
    matrix = next
  }
  return matrix.flat()
})()

function hexToRgb(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

function rgbToHex(rgb: number[]) {
  return `#${rgb
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
    )
    .join("")}`
}

const ink = (hex: string) => 255 - hexToRgb(hex).reduce((a, b) => a + b, 0) / 3

// Push a colour further from white by `factor` (1 = unchanged).
function deepen(hex: string, factor: number) {
  return rgbToHex(hexToRgb(hex).map((v) => 255 - (255 - v) * factor))
}

// The share of each cell the grid's light lines cover, at their opacity —
// what the grid lightens by, and so what the bands are darkened by first.
const gridLightening = ({ gridLine, pitch, gridOpacity }: PixelGradientTexture) => {
  const share = gridLine / pitch
  return share * (2 - share) * gridOpacity
}

// How much "ink" a band carries at t along its fade (0 = deep end, 1 = light
// end), relative to its own deep end. Interpolated between samples.
function coverageAt(colors: string[], samples: number, t: number) {
  const full = Math.max(ink(colors[0]), 1)
  const last = colors.length - 1
  const position = t * samples - 0.5
  if (position <= 0) return 1
  if (position >= last) return ink(colors[last]) / full
  const i = Math.floor(position)
  const f = position - i
  return (ink(colors[i]) * (1 - f) + ink(colors[i + 1]) * f) / full
}

type DitherRun = { band: number; start: number; span: number }

// Dither cells grouped by level, so each level is one mask; neighbouring
// cells on the same level merge into one run. `coverage(band, t)` gives the
// wanted dot density at t along a band's fade (0 = deep end).
function ditherByLevel(
  spec: PixelGradientSpec,
  coverage: (band: PixelGradientBand, t: number) => number
) {
  const levels = new Map<number, DitherRun[]>()
  const add = (level: number, band: number, start: number, end: number) => {
    if (level <= 0) return
    const runs = levels.get(level) ?? []
    runs.push({ band, start, span: end - start })
    levels.set(level, runs)
  }
  spec.bands.forEach((band, bandIndex) => {
    let runLevel = 0
    let runStart = 0
    for (let cell = 0; cell < FRINGE_CELLS; cell++) {
      const t = (cell + 0.5) / FRINGE_CELLS
      const density = Math.min(1, Math.max(0, coverage(band, t)))
      const level = Math.round(density * DITHER_LEVELS)
      if (cell > 0 && level === runLevel) continue
      add(runLevel, bandIndex, runStart, cell)
      runLevel = level
      runStart = cell
    }
    add(runLevel, bandIndex, runStart, FRINGE_CELLS)
  })
  return [...levels.entries()]
}

// Everything derivable from a spec, worked out once. Callers define their art
// at module scope with this, so none of it runs per render.
export function definePixelGradient(spec: PixelGradientSpec) {
  // Ink mode: each sample's share of the deepest sample's ink, by band.
  const deepest = Math.max(
    ...spec.bands.flatMap(({ colors }) => colors.map(ink))
  )
  const amounts = spec.ink
    ? spec.bands.map(({ colors }) =>
        colors.map((hex) =>
          Math.min(1, (ink(hex) / Math.max(deepest, 1)) * spec.ink!.depth)
        )
      )
    : null
  const texture = { ...DEFAULT_TEXTURE, ...spec.texture }
  // Fringe: how far the stretched band outreaches the real one — zero
  // wherever the solid band already covers it, which keeps dots off the deep
  // end.
  const fringe = ditherByLevel(
    spec,
    ({ colors }, t) =>
      coverageAt(colors, spec.samples, t / texture.fringeStretch) -
      Math.max(0, coverageAt(colors, spec.samples, t))
  )
  // Halo: a regular grey dot grid fading out up each band — not dithered,
  // the export's halo dots are all there, just fainter — that stops hard at
  // the band's reach (the halo's own stepped edge). Its opacity is scaled by
  // how much colour has gone, so the grey never sits on the band.
  const [dense, sparse] = texture.haloDensity
  const halo = spec.bands.map(({ halo: reach, colors }) => {
    if (!reach) return null
    const steps = 12
    return Array.from({ length: steps + 1 }, (_, k) => {
      const t = (k / steps) * reach
      const gone =
        1 - Math.min(1, Math.max(0, coverageAt(colors, spec.samples, t)))
      return {
        offset: k / steps,
        opacity: (sparse + (dense - sparse) * (1 - k / steps)) * gone,
      }
    })
  })
  return { spec, texture, fringe, halo, amounts }
}

type PixelGradientArt = ReturnType<typeof definePixelGradient>

const percent = (fraction: number) => `${fraction * 100}%`

export function PixelGradient({
  art,
  className,
  style,
}: {
  art: PixelGradientArt
  className?: string
  style?: React.CSSProperties
}) {
  // Ids are document-global; useId keeps instances (the glow renders twice)
  // from resolving each other's defs. Its punctuation isn't safe in url(#…).
  const uid = `pixel-gradient-${React.useId().replace(/[^\w-]/g, "")}`
  const { spec, texture, fringe, halo, amounts } = art
  const rows = spec.orientation === "rows"
  const [from, to] = spec.extent
  const length = to - from
  const pitch = texture.pitch
  const tile = pitch * DITHER_TILE
  const baseDepth = 1 / (1 - gridLightening(texture))

  // A band's slot across the band axis, and a stretch of its fade axis
  // (t: 0 = deep end, 1 = light end), as SVG rect attributes.
  const rect = (band: PixelGradientBand, t0: number, t1: number) => {
    const across = percent((band.start - from) / length)
    const thickness = percent((band.end - band.start) / length)
    return rows
      ? { x: percent(t0), y: across, width: percent(t1 - t0), height: thickness }
      : { x: across, y: percent(1 - t1), width: thickness, height: percent(t1 - t0) }
  }

  // Fade-axis gradient vector, deep end first. `reach` > 1 stretches it past
  // the box for the fringe layer.
  const vector = (reach: number) =>
    rows
      ? { x1: "0", y1: "0", x2: percent(reach), y2: "0" }
      : { x1: "0", y1: "100%", x2: "0", y2: percent(1 - reach) }

  // A band's gradient stops for one layer. Sampled-colour mode shades the
  // colours themselves; ink mode lays one colour at each sample's ink share.
  const stops = (band: number, layer: "base" | "fringe" | "grain") =>
    spec.bands[band].colors.map((color, k) => {
      const offset = (k + 0.5) / spec.samples
      if (amounts && spec.ink) {
        const amount = amounts[band][k]
        return (
          <stop
            key={k}
            offset={offset}
            stopColor={layer === "grain" ? spec.ink.grain : spec.ink.color}
            stopOpacity={
              layer === "base" ? Math.min(1, amount * baseDepth) : amount
            }
          />
        )
      }
      if (layer === "grain" && texture.grainColor) {
        const colors = spec.bands[band].colors
        const share = Math.min(1, ink(color) / Math.max(ink(colors[0]), 1))
        return (
          <stop
            key={k}
            offset={offset}
            stopColor={texture.grainColor}
            stopOpacity={share}
          />
        )
      }
      const shade =
        layer === "base"
          ? deepen(color, baseDepth)
          : layer === "grain"
            ? deepen(color, texture.grainDepth)
            : color
      return <stop key={k} offset={offset} stopColor={shade} />
    })

  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none", className)}
      style={style}
      width="100%"
      height="100%"
    >
      <defs>
        {spec.bands.map((band, i) => (
          <React.Fragment key={band.start}>
            <linearGradient
              id={`${uid}-band-${i}`}
              gradientUnits="userSpaceOnUse"
              {...vector(1)}
            >
              {stops(i, "base")}
            </linearGradient>
            <linearGradient
              id={`${uid}-fringe-${i}`}
              gradientUnits="userSpaceOnUse"
              {...vector(texture.fringeStretch)}
            >
              {stops(i, "fringe")}
            </linearGradient>
            {texture.grainOpacity > 0 ? (
              <linearGradient
                id={`${uid}-grain-${i}`}
                gradientUnits="userSpaceOnUse"
                {...vector(1)}
              >
                {stops(i, "grain")}
              </linearGradient>
            ) : null}
          </React.Fragment>
        ))}

        {fringe.map(([level]) => (
          <React.Fragment key={level}>
            <pattern
              id={`${uid}-dither-${level}`}
              patternUnits="userSpaceOnUse"
              width={tile}
              height={tile}
            >
              {DITHER_THRESHOLDS.map((threshold, cell) =>
                (threshold * DITHER_LEVELS) / DITHER_THRESHOLDS.length <
                level ? (
                  <rect
                    key={cell}
                    x={(cell % DITHER_TILE) * pitch}
                    y={Math.floor(cell / DITHER_TILE) * pitch}
                    width={pitch * DOT_SHARE}
                    height={pitch * DOT_SHARE}
                    fill="white"
                  />
                ) : null
              )}
            </pattern>
            <mask id={`${uid}-dither-mask-${level}`}>
              <rect
                width="100%"
                height="100%"
                fill={`url(#${uid}-dither-${level})`}
              />
            </mask>
          </React.Fragment>
        ))}

        <pattern
          id={`${uid}-grid`}
          patternUnits="userSpaceOnUse"
          width={pitch}
          height={pitch}
        >
          <rect width={pitch} height={texture.gridLine} fill="white" />
          <rect width={texture.gridLine} height={pitch} fill="white" />
        </pattern>
        {halo.map((stops, i) =>
          stops ? (
            <linearGradient
              key={i}
              id={`${uid}-halo-${i}`}
              gradientUnits="objectBoundingBox"
              {...(rows
                ? { x1: "0", y1: "0", x2: "1", y2: "0" }
                : { x1: "0", y1: "1", x2: "0", y2: "0" })}
            >
              {stops.map(({ offset, opacity }) => (
                <stop
                  key={offset}
                  offset={offset}
                  stopColor={texture.haloColor}
                  stopOpacity={opacity}
                />
              ))}
            </linearGradient>
          ) : null
        )}
        <pattern
          id={`${uid}-halo-dots`}
          patternUnits="userSpaceOnUse"
          width={pitch}
          height={pitch}
        >
          <rect
            width={pitch * texture.haloDot}
            height={pitch * texture.haloDot}
            fill="white"
          />
        </pattern>
        <mask id={`${uid}-halo-mask`}>
          <rect width="100%" height="100%" fill={`url(#${uid}-halo-dots)`} />
        </mask>
        {/* Grain: one small dot per cell, offset from the grid lines. */}
        <pattern
          id={`${uid}-grain-dots`}
          patternUnits="userSpaceOnUse"
          width={pitch}
          height={pitch}
        >
          <rect
            x={pitch * (1 - texture.grainDot) * 0.75}
            y={pitch * (1 - texture.grainDot) * 0.75}
            width={pitch * texture.grainDot}
            height={pitch * texture.grainDot}
            fill="white"
          />
        </pattern>
        <mask id={`${uid}-grain-mask`}>
          <rect width="100%" height="100%" fill={`url(#${uid}-grain-dots)`} />
        </mask>
      </defs>

      {spec.bands.map((band, i) => (
        <rect
          key={band.start}
          {...rect(band, 0, 1)}
          fill={`url(#${uid}-band-${i})`}
          // Band edges land on fractional pixels at most sizes; without this,
          // antialiasing leaves a hairline seam between neighbours.
          shapeRendering="crispEdges"
        />
      ))}

      {texture.grainOpacity > 0 ? (
        <g mask={`url(#${uid}-grain-mask)`} opacity={texture.grainOpacity}>
          {spec.bands.map((band, i) => (
            <rect
              key={band.start}
              {...rect(band, 0, 1)}
              fill={`url(#${uid}-grain-${i})`}
              shapeRendering="crispEdges"
            />
          ))}
        </g>
      ) : null}

      <g mask={`url(#${uid}-halo-mask)`}>
        {spec.bands.map((band, i) =>
          halo[i] && band.halo ? (
            <rect
              key={band.start}
              {...rect(band, 0, band.halo)}
              fill={`url(#${uid}-halo-${i})`}
              shapeRendering="crispEdges"
            />
          ) : null
        )}
      </g>

      <g opacity={texture.fringeOpacity}>
        {fringe.map(([level, runs]) => (
          <g key={level} mask={`url(#${uid}-dither-mask-${level})`}>
            {runs.map(({ band, start, span }) => (
              <rect
                key={`${band}-${start}`}
                {...rect(
                  spec.bands[band],
                  start / FRINGE_CELLS,
                  (start + span) / FRINGE_CELLS
                )}
                fill={`url(#${uid}-fringe-${band})`}
                shapeRendering="crispEdges"
              />
            ))}
          </g>
        ))}
      </g>

      <rect
        width="100%"
        height="100%"
        fill={`url(#${uid}-grid)`}
        opacity={texture.gridOpacity}
      />
    </svg>
  )
}
