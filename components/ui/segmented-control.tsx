"use client"

import * as React from "react"
import Link from "next/link"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

interface SegmentedControlItem {
  label: string
  value: string
  disabled?: boolean
  // When set, the tab navigates to a route (e.g. switching between /signup
  // and /login) instead of switching a panel within the same page.
  href?: string
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
      <TabsPrimitive.List className="relative flex items-start gap-0 rounded-rad-xmd bg-surface-2 p-pad-xs">
        <TabsPrimitive.Indicator
          renderBeforeHydration
          className={cn(
            // Only transform is animated (never left/width) so the slide
            // stays GPU-only — see components/ui/segmented-control.tsx review
            // note in the animation skill: layout properties are a
            // performance finding. The curve is the "moving/morphing on
            // screen" strong ease-in-out from the animation standards doc;
            // Tailwind's built-in ease-in-out is too weak for this.
            "absolute inset-y-pad-xs left-0 z-0 rounded-rad-md bg-surface-4 shadow-[0px_1px_1px_0px_rgba(25,25,25,0.24)] transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)]"
          )}
          style={{
            width: "var(--active-tab-width)",
            transform: "translateX(var(--active-tab-left))",
          }}
        />
        {items.map((item) => {
          const active = item.value === value
          return (
            <TabsPrimitive.Tab
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              render={item.href ? <Link href={item.href} /> : undefined}
              className={cn(
                // Bracket syntax avoids tailwind-merge evicting this font-size
                // token in favor of the text-color utility below — see the
                // same workaround in button.tsx/pill-input.tsx.
                "relative z-10 flex h-8 flex-1 cursor-pointer items-center justify-center rounded-rad-md px-pad-xs text-center whitespace-nowrap text-[length:var(--text-body-lg-bold)] leading-[var(--text-body-lg-bold--line-height)] tracking-[var(--text-body-lg-bold--letter-spacing)] font-bold font-sans outline-none transition-colors duration-150 ease",
                active
                  ? "text-text-bold"
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
