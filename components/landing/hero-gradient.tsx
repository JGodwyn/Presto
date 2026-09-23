"use client"

import { motion, useReducedMotion, type Transition } from "motion/react"

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

const HERO_SETTINGS: HeroStudioSettings = {
  bars: HERO_BAR_DEFAULTS,
  texture: HERO_TEXTURE_DEFAULTS,
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
}: {
  settings: HeroStudioSettings
  animation: HeroGradientMotionSettings
}) {
  const panels = resolvePanels(settings)
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimate = animation.enabled && !prefersReducedMotion

  return (
    <svg
      data-hero-gradient
      aria-hidden="true"
      viewBox={`0 0 ${HERO_WIDTH} ${HERO_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 size-full"
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
            id={`hero-field-${panel.id}`}
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
          id="hero-field-reveal"
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
        <mask id="hero-field-mask" x="0" y="0" width={HERO_WIDTH} height={HERO_HEIGHT}>
          <rect width={HERO_WIDTH} height={HERO_HEIGHT} fill="url(#hero-field-reveal)" />
        </mask>

        <linearGradient
          id="hero-dot-reveal"
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
        <mask id="hero-dot-reveal-mask" x="0" y="0" width={HERO_WIDTH} height={HERO_HEIGHT}>
          <rect width={HERO_WIDTH} height={HERO_HEIGHT} fill="url(#hero-dot-reveal)" />
        </mask>
        <pattern
          id="hero-color-dots"
          patternUnits="userSpaceOnUse"
          width="4"
          height="4"
        >
          <circle cx="2" cy="2" r={settings.texture.halftoneRadius} fill="var(--gray-0)" />
        </pattern>
        <mask id="hero-dot-mask" x="0" y="0" width={HERO_WIDTH} height={HERO_HEIGHT}>
          <rect width={HERO_WIDTH} height={HERO_HEIGHT} fill="url(#hero-color-dots)" />
        </mask>

        <pattern
          id="hero-paper-dots"
          patternUnits="userSpaceOnUse"
          width="4"
          height="4"
        >
          <circle cx="2" cy="2" r={settings.texture.paperRadius} fill="var(--surface-3)" />
        </pattern>
        <filter
          id="hero-grain"
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

      <g mask="url(#hero-field-mask)">
        {panels.map((panel, index) => {
          const orderIndex = revealOrderIndex(index, panels.length, animation.order)
          const delay = animation.delay + orderIndex * animation.stagger

          return (
            <motion.rect
              key={`field-${panel.id}`}
              x={panel.x}
              width={panel.width}
              height={HERO_HEIGHT}
              fill={`url(#hero-field-${panel.id})`}
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

      <g mask="url(#hero-dot-reveal-mask)">
        <g mask="url(#hero-dot-mask)">
          {panels.map((panel, index) => {
            const orderIndex = revealOrderIndex(index, panels.length, animation.order)
            const delay = animation.delay + orderIndex * animation.stagger

            return (
              <motion.rect
                key={`dots-${panel.id}`}
                x={panel.x}
                width={panel.width}
                height={HERO_HEIGHT}
                fill={`url(#hero-field-${panel.id})`}
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
        mask="url(#hero-field-mask)"
        filter={settings.texture.grainEnabled ? "url(#hero-grain)" : undefined}
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
              fill="url(#hero-paper-dots)"
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

function HeroGradient() {
  return (
    <HeroGradientArtwork
      settings={HERO_SETTINGS}
      animation={HERO_ANIMATION}
    />
  )
}

export { HeroGradient }
