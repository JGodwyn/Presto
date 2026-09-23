type FooterGradientProps = {
  side: "left" | "right"
}

const LEFT_PANELS = [
  { x: 350, y: 0, width: 64, opacity: 0.72 },
  { x: 414, y: 126, width: 134, opacity: 0.62 },
  { x: 548, y: 382, width: 106, opacity: 0.7 },
  { x: 654, y: 548, width: 24, opacity: 0.76 },
] as const

const RIGHT_PANELS = [
  { x: 0, y: 548, width: 24, opacity: 0.76 },
  { x: 24, y: 382, width: 106, opacity: 0.7 },
  { x: 130, y: 126, width: 134, opacity: 0.62 },
  { x: 264, y: 0, width: 40, opacity: 0.72 },
] as const

function FooterGradient({ side }: FooterGradientProps) {
  const gradientId = `footer-panel-gradient-${side}`
  const barFadeId = `footer-bar-fade-${side}`
  const barMaskId = `footer-bar-mask-${side}`
  const glowId = `footer-panel-glow-${side}`
  const grainId = `footer-panel-grain-${side}`
  const panels = side === "left" ? LEFT_PANELS : RIGHT_PANELS

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 678 1017"
      preserveAspectRatio="none"
      className="size-full"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--purple-700)" />
          <stop offset="0.18" stopColor="var(--purple-700)" />
          <stop offset="0.544061" stopColor="var(--purple-400)" />
          <stop offset="0.689655" stopColor="var(--lime-200)" />
          <stop offset="1" stopColor="var(--flame-0)" />
        </linearGradient>
        <linearGradient
          id={barFadeId}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0" stopColor="var(--gray-0)" stopOpacity="0" />
          <stop offset="0.06" stopColor="var(--gray-0)" stopOpacity="0" />
          <stop offset="0.18" stopColor="var(--gray-0)" />
        </linearGradient>
        <mask
          id={barMaskId}
          maskUnits="objectBoundingBox"
          maskContentUnits="objectBoundingBox"
          x="0"
          y="0"
          width="1"
          height="1"
        >
          <rect
            x="0"
            y="0"
            width="1"
            height="1"
            fill={`url(#${barFadeId})`}
          />
        </mask>
        <filter
          id={glowId}
          x="-0.5"
          y="-0.2"
          width="2"
          height="1.4"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="34" />
        </filter>
        <filter
          id={grainId}
          x="0"
          y="0"
          width="1"
          height="1"
          colorInterpolationFilters="sRGB"
        >
          {/* Gradientool uses blurred medium grain at 0.75 × 0.95 in
              soft-light, then fine grain at 0.75 × 0.3 in overlay. */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.55"
            numOctaves="1"
            seed={side === "left" ? 17 : 29}
            stitchTiles="stitch"
            result="mediumNoise"
          />
          <feColorMatrix
            in="mediumNoise"
            type="matrix"
            values=".48 0 0 0 .27 .48 0 0 0 .26 .48 0 0 0 .23 0 0 0 0 .7125"
            result="mediumColor"
          />
          <feComposite
            in="mediumColor"
            in2="SourceAlpha"
            operator="in"
            result="clippedMedium"
          />
          <feGaussianBlur
            in="clippedMedium"
            stdDeviation="0.3"
            result="mediumGrain"
          />
          <feBlend
            in="SourceGraphic"
            in2="mediumGrain"
            mode="soft-light"
            result="mediumBlend"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.95"
            numOctaves="1"
            seed={side === "left" ? 37 : 43}
            stitchTiles="stitch"
            result="fineNoise"
          />
          <feColorMatrix
            in="fineNoise"
            type="matrix"
            values=".24 0 0 0 .38 .24 0 0 0 .38 .24 0 0 0 .38 0 0 0 0 .225"
            result="fineColor"
          />
          <feComposite
            in="fineColor"
            in2="SourceAlpha"
            operator="in"
            result="fineGrain"
          />
          <feBlend
            in="mediumBlend"
            in2="fineGrain"
            mode="overlay"
          />
        </filter>
      </defs>

      <g opacity="0.48" filter={`url(#${glowId})`}>
        {panels.map((panel) => (
          <rect
            key={`glow-${panel.x}-${panel.y}`}
            x={panel.x}
            y={panel.y}
            width={panel.width}
            height={1017 - panel.y}
            fill={`url(#${gradientId})`}
            mask={`url(#${barMaskId})`}
          />
        ))}
      </g>

      <g filter={`url(#${grainId})`}>
        {panels.map((panel) => (
          <rect
            key={`${panel.x}-${panel.y}`}
            x={panel.x}
            y={panel.y}
            width={panel.width}
            height={1017 - panel.y}
            fill={`url(#${gradientId})`}
            opacity={panel.opacity}
            mask={`url(#${barMaskId})`}
          />
        ))}
      </g>
    </svg>
  )
}

export { FooterGradient }
