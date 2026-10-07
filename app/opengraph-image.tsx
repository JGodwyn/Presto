import { ImageResponse } from "next/og"

import {
  StackedWordmark,
  loadBrandColors,
  loadBrandFont,
  loadBrandMark,
} from "@/lib/brand-image"
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site"

export const alt = `${SITE_NAME} — ${SITE_DESCRIPTION}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Picked up by Next for both og:image and twitter:image.
export default async function OpengraphImage() {
  const [colors, font, mark] = await Promise.all([
    loadBrandColors(),
    loadBrandFont(),
    loadBrandMark(),
  ])
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: colors.ink,
        }}
      >
        <img src={mark} width={160} height={160} alt="" />
        <StackedWordmark text={SITE_NAME} fontSize={160} colors={colors} />
        <div
          style={{
            display: "flex",
            fontFamily: "Phudu",
            fontSize: 44,
            color: colors.muted,
          }}
        >
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size, fonts: [font] }
  )
}
