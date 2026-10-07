import { readFile } from "node:fs/promises"
import { join } from "node:path"

// Shared by the code-generated metadata images (app/icon.tsx,
// app/apple-icon.tsx, app/opengraph-image.tsx). ImageResponse renders outside
// the browser, so neither Tailwind classes nor next/font reach it: colours are
// read out of app/globals.css (where every token resolves) and the display
// face out of a local copy of Phudu.

export type BrandColors = {
  purple: string
  lime: string
  flame: string
  ink: string
  muted: string
}

function readToken(css: string, name: string) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8});`))
  if (!match) throw new Error(`Token --${name} not found in app/globals.css`)
  return match[1]
}

export async function loadBrandColors(): Promise<BrandColors> {
  const css = await readFile(join(process.cwd(), "app/globals.css"), "utf8")
  return {
    purple: readToken(css, "purple-400"),
    lime: readToken(css, "lime-200"),
    flame: readToken(css, "flame-400"),
    ink: readToken(css, "gray-1000"),
    muted: readToken(css, "gray-300"),
  }
}

// A static Bold cut of Phudu (the wordmark's weight): Satori can't parse a
// variable font's fvar table, so the variable file next/font uses won't load.
export async function loadBrandFont() {
  const data = await readFile(
    join(process.cwd(), "app/fonts/phudu/Phudu-Bold.ttf")
  )
  return { name: "Phudu", data, style: "normal" as const, weight: 700 as const }
}

// The colour wordmark from components/landing/presto-logo.tsx: three copies
// stacked with small x-offsets (purple left, lime right, flame on top) to fake
// an extruded edge. There the offsets are 2 / 10 / 6px at 43px; here they're
// a fraction of the font size so the shape holds from favicon to social card.
export function StackedWordmark({
  text,
  fontSize,
  colors,
}: {
  text: string
  fontSize: number
  colors: BrandColors
}) {
  const shift = Math.max(1, Math.round(fontSize * (4 / 43)))
  const layer = (color: string, left: number) => (
    <span style={{ position: "absolute", top: 0, left, color }}>{text}</span>
  )

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        fontFamily: "Phudu",
        fontSize,
        lineHeight: 1,
      }}
    >
      {/* An invisible in-flow copy sizes the stack; the visible layers sit
          absolutely on top of it. */}
      <span style={{ color: "transparent", paddingRight: shift * 2 }}>{text}</span>
      {layer(colors.purple, 0)}
      {layer(colors.lime, shift * 2)}
      {layer(colors.flame, shift)}
    </div>
  )
}
