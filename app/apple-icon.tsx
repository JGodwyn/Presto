import { ImageResponse } from "next/og"

import { StackedWordmark, loadBrandColors, loadBrandFont } from "@/lib/brand-image"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

// Full-bleed, unlike app/icon.tsx: iOS applies its own rounded mask.
export default async function AppleIcon() {
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
        }}
      >
        <StackedWordmark text="P" fontSize={128} colors={colors} />
      </div>
    ),
    { ...size, fonts: [font] }
  )
}
