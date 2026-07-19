"use client"

import * as React from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"

import { cn } from "@/lib/utils"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma radii as px for the squircle path math: the surface-3 card
// (--rad-lg), the surface-2 pill each option sits in (--rad-xmd), and the
// 20px radio circle itself (--rad-rd, full round).
const CARD_CORNER_RADIUS = 16
const PILL_CORNER_RADIUS = 12
const CIRCLE_CORNER_RADIUS = 10

interface RadioCardOption {
  value: string
  label: string
}

function RadioPill({ option }: { option: RadioCardOption }) {
  const { ref: pillRef, style: pillStyle } = useSquircleClipPath<HTMLLabelElement>(
    { cornerRadius: PILL_CORNER_RADIUS }
  )
  const { ref: circleRef, style: circleStyle } =
    useSquircleClipPath<HTMLSpanElement>({ cornerRadius: CIRCLE_CORNER_RADIUS })

  return (
    <label
      ref={pillRef}
      style={pillStyle}
      className="flex cursor-pointer items-center gap-dist-sm rounded-rad-xmd bg-surface-2 px-pad-md py-pad-sm"
    >
      <Radio.Root
        value={option.value}
        className="group/radio outline-none"
      >
        {/* The circle's own colors respond to the root's data-checked
            (same attribute Switch already keys off) rather than a
            second piece of state — one source of truth. */}
        <span
          ref={circleRef}
          style={circleStyle}
          className="flex size-5 items-center justify-center rounded-full border-[length:var(--stroke-lg)] border-border-bold bg-surface-3 transition-colors duration-150 ease group-focus-visible/radio:ring-3 group-focus-visible/radio:ring-ring/50 group-data-[checked]/radio:border-border-inverse group-data-[checked]/radio:bg-surface-brand"
        >
          <Radio.Indicator className="size-2 rounded-full bg-surface-4" />
        </span>
      </Radio.Root>
      <span className="text-body-lg text-text-bold">{option.label}</span>
    </label>
  )
}

// "Posting cadence" / "How do you want to select dates?" cards from the
// Figma "Generate (Calendar based)" exports: both are a labeled surface-3
// card holding a row of pill-wrapped radio options — identical shape, only
// the label/options differ, so one component covers both.
function RadioCardGroup({
  label,
  options,
  value,
  onValueChange,
}: {
  label: string
  options: RadioCardOption[]
  value: string
  onValueChange: (value: string) => void
}) {
  const { ref: cardRef, style: cardStyle } = useSquircleClipPath<HTMLDivElement>(
    { cornerRadius: CARD_CORNER_RADIUS }
  )

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      className={cn(
        "flex w-full flex-col gap-dist-md rounded-rad-lg bg-surface-3 px-pad-md py-pad-sm"
      )}
    >
      <span className="text-body-lg text-text-bold">{label}</span>
      <RadioGroup
        value={value}
        onValueChange={(next) => onValueChange(next as string)}
        className="flex flex-wrap items-center gap-dist-md"
      >
        {options.map((option) => (
          <RadioPill key={option.value} option={option} />
        ))}
      </RadioGroup>
    </div>
  )
}

export { RadioCardGroup }
