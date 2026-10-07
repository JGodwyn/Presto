import { ImageResponse } from "next/og"

import { StackedWordmark, loadBrandColors, loadBrandFont } from "@/lib/brand-image"

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

// The wordmark's "P" on its own — "Presto" is unreadable at tab size.
export default async function Icon() {
  const [colors, font] = await Promise.all([loadBrandColors(), loadBrandFont()])
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.ink,
          borderRadius: 14,
        }}
      >
        <StackedWordmark text="P" fontSize={50} colors={colors} />
      </div>
    ),
    { ...size, fonts: [font] }
  )
}
