"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

interface SegmentedControlItem {
  label: string
  value: string
  disabled?: boolean
}

interface SegmentedControlProps
  extends Omit<TabsPrimitive.Root.Props, "children"> {
  items: SegmentedControlItem[]
}

function SegmentedControl({
  items,
  value,
  className,
  ...props
}: SegmentedControlProps) {
  return (
    <TabsPrimitive.Root
      data-slot="segmented-control"
      value={value}
      className={cn("w-full", className)}
      {...props}
    >
      <TabsPrimitive.List className="flex items-start gap-0 rounded-rad-xmd bg-surface-2 p-pad-xs">
        {items.map((item) => {
          const active = item.value === value
          return (
            <TabsPrimitive.Tab
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className={cn(
                // Bracket syntax avoids tailwind-merge evicting this font-size
                // token in favor of the text-color utility below — see the
                // same workaround in button.tsx/pill-input.tsx.
                "flex h-8 flex-1 items-center justify-center rounded-rad-md px-pad-xs text-center whitespace-nowrap text-[length:var(--text-body-lg-bold)] leading-[var(--text-body-lg-bold--line-height)] tracking-[var(--text-body-lg-bold--letter-spacing)] font-bold font-sans outline-none",
                active
                  ? "bg-surface-4 text-text-bold shadow-[0px_1px_1px_0px_rgba(25,25,25,0.24)]"
                  : "text-text-subtle disabled:cursor-default"
              )}
            >
              {item.label}
            </TabsPrimitive.Tab>
          )
        })}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  )
}

export { SegmentedControl }
