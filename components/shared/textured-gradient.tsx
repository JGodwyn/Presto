"use client"

import * as React from "react"
import { motion, useReducedMotion, type Transition } from "motion/react"

import { cn } from "@/lib/utils"

type HeroBarId = "bar1" | "bar2" | "bar3" | "bar4" | "bar5" | "bar6" | "bar7"

type HeroBarSettings = {
  enabled: boolean
  width: number
  surfaceEnd: number
  upperPosition: number
  upperColor: string
  middlePosition: number
  middleColor: string
  extraEnabled: boolean
  extraPosition: number
  extraColor: string
  bottomColor: string
}

type HeroTextureSettings = {
  grainEnabled: boolean
  grainIntensity: number
  grainFrequency: number
  grainOctaves: number
  grainSeed: number
  halftoneRadius: number
  paperRadius: number
  paperOpacity: number
}

type HeroStudioSettings = {
  bars: Record<HeroBarId, HeroBarSettings>
  texture: HeroTextureSettings
}

type HeroGradientOrder = "left-to-right" | "right-to-left" | "center-out" | "together"

type HeroGradientMotionSettings = {
  enabled: boolean
  delay: number
  stagger: number
  startHeight: number
  order: HeroGradientOrder
  transition: Transition
}

const HERO_WIDTH = 1440
const HERO_HEIGHT = 1024
const HERO_BAR_IDS: HeroBarId[] = ["bar1", "bar2", "bar3", "bar4", "bar5", "bar6", "bar7"]

const HERO_BAR_DEFAULTS: Record<HeroBarId, HeroBarSettings> = {
  bar1: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.54,
    upperPosition: 0.51,
    upperColor: "var(--surface-4)",
    middlePosition: 0.79,
    middleColor: "#ff4901",
    extraEnabled: true,
    extraPosition: 0.9,
    extraColor: "#bb00ff",
    bottomColor: "#ab03ef",
  },
  bar2: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.54,
    upperPosition: 0.66,
    upperColor: "#ffaa93",
    middlePosition: 0.8,
    middleColor: "#ff4901",
    extraEnabled: true,
    extraPosition: 0.9,
    extraColor: "#c000f5",
    bottomColor: "#ab03ef",
  },
  bar3: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.54,
    upperPosition: 0.67,
    upperColor: "#ffaa93",
    middlePosition: 0.8,
    middleColor: "#ff4901",
    extraEnabled: true,
    extraPosition: 0.9,
    extraColor: "#a200fa",
    bottomColor: "#8b01c2",
  },
  bar4: {
    enabled: true,
    width: 124,
    surfaceEnd: 0.52,
    upperPosition: 0.6,
    upperColor: "#ffd2c5",
    middlePosition: 0.81,
    middleColor: "#ff470a",
    extraEnabled: true,
    extraPosition: 0.9,
    extraColor: "#a600ff",
    bottomColor: "#aa01c1",
  },
  bar5: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.48,
    upperPosition: 0.61,
    upperColor: "#ffd2c5",
    middlePosition: 0.79,
    middleColor: "#ff470a",
    extraEnabled: true,
    extraPosition: 0.9,
    extraColor: "#ab03ef",
    bottomColor: "#8700bd",
  },
  bar6: {
    enabled: false,
    width: 120,
    surfaceEnd: 0.54,
    upperPosition: 0.66,
    upperColor: "#ebd2ff",
    middlePosition: 0.8,
    middleColor: "#c04ffe",
    extraEnabled: true,
    extraPosition: 0.9,
    extraColor: "#ab03ef",
    bottomColor: "#8f00cc",
  },
  bar7: {
    enabled: false,
    width: 120,
    surfaceEnd: 0.54,
    upperPosition: 0.66,
    upperColor: "#f53500",
    middlePosition: 0.8,
    middleColor: "#ce82fe",
    extraEnabled: false,
    extraPosition: 0.9,
    extraColor: "#ab03ef",
    bottomColor: "#8b01c2",
  },
}

const HERO_TEXTURE_DEFAULTS: HeroTextureSettings = {
  grainEnabled: true,
  grainIntensity: 0.7,
  grainFrequency: 1.4,
  grainOctaves: 2,
  grainSeed: 71,
  halftoneRadius: 1.36,
  paperRadius: 0.43,
  paperOpacity: 0.82,
}

// The auth screens' palette, sampled from the raster it replaces
// (public/images/auth/signup-background.png): seven even bars running warm to
// cool, amber→magenta at the left through pink→blue at the right. Stops are
// placed for AuthShell's bottom band, not the landing hero's full-bleed frame
// — the band's aspect crops the viewBox to roughly y 106-918, which these
// positions land inside. extraColor repeats bottomColor so each bar goes solid
// from there down, as the raster does.
const AUTH_BAR_SETTINGS: Record<HeroBarId, HeroBarSettings> = {
  bar1: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.57,
    upperPosition: 0.64,
    upperColor: "#f8dcbb",
    middlePosition: 0.715,
    middleColor: "#e18600",
    extraEnabled: true,
    extraPosition: 0.81,
    extraColor: "#ee009b",
    bottomColor: "#ee009b",
  },
  bar2: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.57,
    upperPosition: 0.64,
    upperColor: "#fad9bd",
    middlePosition: 0.715,
    middleColor: "#eb7600",
    extraEnabled: true,
    extraPosition: 0.81,
    extraColor: "#e000c0",
    bottomColor: "#e000c0",
  },
  bar3: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.57,
    upperPosition: 0.64,
    upperColor: "#fdd7c0",
    middlePosition: 0.715,
    middleColor: "#f76a04",
    extraEnabled: true,
    extraPosition: 0.81,
    extraColor: "#cd00e2",
    bottomColor: "#cd00e2",
  },
  bar4: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.57,
    upperPosition: 0.64,
    upperColor: "#ffd4c3",
    middlePosition: 0.715,
    middleColor: "#ff6337",
    extraEnabled: true,
    extraPosition: 0.81,
    extraColor: "#b700ff",
    bottomColor: "#b700ff",
  },
  bar5: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.57,
    upperPosition: 0.64,
    upperColor: "#ffd0c7",
    middlePosition: 0.715,
    middleColor: "#ff5f5e",
    extraEnabled: true,
    extraPosition: 0.81,
    extraColor: "#9d28ff",
    bottomColor: "#9d28ff",
  },
  bar6: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.57,
    upperPosition: 0.64,
    upperColor: "#ffcbd1",
    middlePosition: 0.715,
    middleColor: "#ff5d7d",
    extraEnabled: true,
    extraPosition: 0.81,
    extraColor: "#7e3eff",
    bottomColor: "#7e3eff",
  },
  bar7: {
    enabled: true,
    width: 120,
    surfaceEnd: 0.57,
    upperPosition: 0.64,
    upperColor: "#fdcbd9",
    middlePosition: 0.715,
    middleColor: "#f75e9d",
    extraEnabled: true,
    extraPosition: 0.81,
    extraColor: "#5352ff",
    bottomColor: "#5352ff",
  },
}

type TexturedGradientVariant = "landing" | "auth"

const VARIANT_SETTINGS: Record<TexturedGradientVariant, HeroStudioSettings> = {
  landing: { bars: HERO_BAR_DEFAULTS, texture: HERO_TEXTURE_DEFAULTS },
  auth: { bars: AUTH_BAR_SETTINGS, texture: HERO_TEXTURE_DEFAULTS },
}

const HERO_ANIMATION: HeroGradientMotionSettings = {
  enabled: true,
  delay: 0.1,
  stagger: 0,
  startHeight: 0,
  order: "together",
  transition: { type: "spring", stiffness: 200, damping: 32, mass: 9 },
}

function resolvePanels(settings: HeroStudioSettings) {
  const enabledIds = HERO_BAR_IDS.filter((id) => settings.bars[id].enabled)
  const visibleIds = enabledIds.length > 0 ? enabledIds : [HERO_BAR_IDS[0]]
  const totalWidth = visibleIds.reduce((total, id) => total + settings.bars[id].width, 0)
  let x = 0

  return visibleIds.map((id, index) => {
    const settingsForBar = settings.bars[id]
    const width =
      index === visibleIds.length - 1
        ? HERO_WIDTH - x
        : (settingsForBar.width / totalWidth) * HERO_WIDTH
    const panel = { id, x, width, settings: settingsForBar }
    x += width
    return panel
  })
}

function revealOrderIndex(
  index: number,
  panelCount: number,
  order: HeroGradientOrder
) {
  if (order === "right-to-left") return panelCount - index - 1
  if (order === "together") return 0
  if (order === "center-out") {
    const center = (panelCount - 1) / 2
    const indices = Array.from({ length: panelCount }, (_, itemIndex) => itemIndex).sort(
      (left, right) => Math.abs(left - center) - Math.abs(right - center)
    )
    return indices.indexOf(index)
  }
  return index
}

function HeroGradientArtwork({
  settings,
  animation,
  className,
}: {
  settings: HeroStudioSettings
  animation: HeroGradientMotionSettings
  className?: string
}) {
  // Every gradient, mask and pattern is referenced by id, and ids are
  // document-global — two instances on one page (sidebar + panel) would
  // otherwise resolve each other's definitions. useId's own punctuation
  // (":r0:" / "«r0»") is stripped since it isn't safe inside url(#…).
  const uid = `textured-gradient-${React.useId().replace(/[^\w-]/g, "")}`
  const panels = resolvePanels(settings)
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimate = animation.enabled && !prefersReducedMotion

  return (
    <svg
      data-textured-gradient
      aria-hidden="true"
      viewBox={`0 0 ${HERO_WIDTH} ${HERO_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      <defs>
        {panels.map((panel) => {
          const stops = [
            { offset: panel.settings.surfaceEnd, color: "var(--surface-4)" },
            { offset: panel.settings.upperPosition, color: panel.settings.upperColor },
            { offset: panel.settings.middlePosition, color: panel.settings.middleColor },
            ...(panel.settings.extraEnabled
              ? [{ offset: panel.settings.extraPosition, color: panel.settings.extraColor }]
              : []),
            { offset: 1, color: panel.settings.bottomColor },
          ].sort((a, b) => a.offset - b.offset)

          return (
          <linearGradient
            key={panel.id}
            id={`${uid}-field-${panel.id}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" stopColor="var(--surface-4)" />
            {stops.map((stop, index) => (
              <stop
                key={`${stop.offset}-${stop.color}-${index}`}
                offset={stop.offset}
                stopColor={stop.color}
              />
            ))}
          </linearGradient>
          )
        })}

        <linearGradient
          id={`${uid}-field-reveal`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="500"
          x2="0"
          y2="820"
        >
          <stop offset="0" stopColor="var(--gray-0)" stopOpacity="0" />
          <stop offset="0.28" stopColor="var(--gray-0)" stopOpacity="0" />
          <stop offset="0.72" stopColor="var(--gray-0)" stopOpacity="0.74" />
          <stop offset="1" stopColor="var(--gray-0)" />
        </linearGradient>
        <mask id={`${uid}-field-mask`} x="0" y="0" width={HERO_WIDTH} height={HERO_HEIGHT}>
          <rect width={HERO_WIDTH} height={HERO_HEIGHT} fill={`url(#${uid}-field-reveal)`} />
        </mask>

        <linearGradient
          id={`${uid}-dot-reveal`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="560"
          x2="0"
          y2="790"
        >
          <stop offset="0" stopColor="var(--gray-0)" stopOpacity="0" />
          <stop offset="0.18" stopColor="var(--gray-0)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--gray-0)" />
        </linearGradient>
        <mask id={`${uid}-dot-reveal-mask`} x="0" y="0" width={HERO_WIDTH} height={HERO_HEIGHT}>
          <rect width={HERO_WIDTH} height={HERO_HEIGHT} fill={`url(#${uid}-dot-reveal)`} />
        </mask>
        <pattern
          id={`${uid}-color-dots`}
          patternUnits="userSpaceOnUse"
          width="4"
          height="4"
        >
          <circle cx="2" cy="2" r={settings.texture.halftoneRadius} fill="var(--gray-0)" />
        </pattern>
        <mask id={`${uid}-dot-mask`} x="0" y="0" width={HERO_WIDTH} height={HERO_HEIGHT}>
          <rect width={HERO_WIDTH} height={HERO_HEIGHT} fill={`url(#${uid}-color-dots)`} />
        </mask>

        <pattern
          id={`${uid}-paper-dots`}
          patternUnits="userSpaceOnUse"
          width="4"
          height="4"
        >
          <circle cx="2" cy="2" r={settings.texture.paperRadius} fill="var(--surface-3)" />
        </pattern>
        <filter
          id={`${uid}-grain`}
          x="0"
          y="0"
          width="1"
          height="1"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency={settings.texture.grainFrequency}
            numOctaves={settings.texture.grainOctaves}
            seed={settings.texture.grainSeed}
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values={`.18 0 0 0 .41 .18 0 0 0 .41 .18 0 0 0 .41 0 0 0 0 ${settings.texture.grainIntensity}`}
            result="neutralNoise"
          />
          <feComposite
            in="neutralNoise"
            in2="SourceAlpha"
            operator="in"
            result="clippedNoise"
          />
          <feBlend in="SourceGraphic" in2="clippedNoise" mode="soft-light" />
        </filter>
      </defs>

      <rect width={HERO_WIDTH} height={HERO_HEIGHT} fill="var(--surface-4)" />

      <g mask={`url(#${uid}-field-mask)`}>
        {panels.map((panel, index) => {
          const orderIndex = revealOrderIndex(index, panels.length, animation.order)
          const delay = animation.delay + orderIndex * animation.stagger

          return (
            <motion.rect
              key={`field-${panel.id}`}
              x={panel.x}
              width={panel.width}
              height={HERO_HEIGHT}
              fill={`url(#${uid}-field-${panel.id})`}
              style={{ transformBox: "fill-box", originX: 0.5, originY: 1 }}
              initial={
                shouldAnimate
                  ? { transform: `scaleY(${animation.startHeight})` }
                  : false
              }
              animate={{ transform: "scaleY(1)" }}
              transition={{ ...animation.transition, delay }}
            />
          )
        })}
      </g>

      <g mask={`url(#${uid}-dot-reveal-mask)`}>
        <g mask={`url(#${uid}-dot-mask)`}>
          {panels.map((panel, index) => {
            const orderIndex = revealOrderIndex(index, panels.length, animation.order)
            const delay = animation.delay + orderIndex * animation.stagger

            return (
              <motion.rect
                key={`dots-${panel.id}`}
                x={panel.x}
                width={panel.width}
                height={HERO_HEIGHT}
                fill={`url(#${uid}-field-${panel.id})`}
                style={{ transformBox: "fill-box", originX: 0.5, originY: 1 }}
                initial={
                  shouldAnimate
                    ? { transform: `scaleY(${animation.startHeight})` }
                    : false
                }
                animate={{ transform: "scaleY(1)" }}
                transition={{ ...animation.transition, delay }}
              />
            )
          })}
        </g>
      </g>

      <g
        mask={`url(#${uid}-field-mask)`}
        filter={settings.texture.grainEnabled ? `url(#${uid}-grain)` : undefined}
      >
        {panels.map((panel, index) => {
          const orderIndex = revealOrderIndex(index, panels.length, animation.order)
          const delay = animation.delay + orderIndex * animation.stagger

          return (
            <motion.rect
              key={`paper-${panel.id}`}
              x={panel.x}
              y="610"
              width={panel.width}
              height="414"
              fill={`url(#${uid}-paper-dots)`}
              opacity={settings.texture.paperOpacity}
              style={{ transformBox: "fill-box", originX: 0.5, originY: 1 }}
              initial={
                shouldAnimate
                  ? { transform: `scaleY(${animation.startHeight})` }
                  : false
              }
              animate={{ transform: "scaleY(1)" }}
              transition={{ ...animation.transition, delay }}
            />
          )
        })}
      </g>
    </svg>
  )
}

function TexturedGradient({
  variant = "landing",
  className,
}: {
  variant?: TexturedGradientVariant
  className?: string
}) {
  return (
    <HeroGradientArtwork
      settings={VARIANT_SETTINGS[variant]}
      animation={HERO_ANIMATION}
      className={className}
    />
  )
}

export { TexturedGradient }
