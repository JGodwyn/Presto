"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { MagnifyingGlass } from "@phosphor-icons/react"

import type { GatewayModelOption } from "@/app/projects/[projectId]/settings/model-actions"
import { Menu, MenuItem } from "@/components/ui/menu"
import { PillInput } from "@/components/ui/pill-input"

// The gateway publishes prices as USD per token, which is unreadable at
// human scale (Gemini Flash input is ~0.0000003). Per-million is how every
// provider actually quotes it.
const TOKENS_PER_PRICE_UNIT = 1_000_000

function formatPrice(perToken: string | null): string | null {
  if (perToken == null) return null
  const perMillion = Number(perToken) * TOKENS_PER_PRICE_UNIT
  if (!Number.isFinite(perMillion)) return null
  // Sub-dollar rates would collapse toward "$0.00" at two decimals — the
  // cheap models are exactly the ones worth being able to tell apart.
  return `$${perMillion < 1 ? perMillion.toFixed(3) : perMillion.toFixed(2)}/M in`
}

// Searchable single-select over the provider's model catalog. Structurally
// the same combobox as components/instructions/topic-picker.tsx — opens on
// focus, filters as you type, arrow/Enter/Escape keyboard nav, portaled menu
// (every ancestor here is squircle-clipped, and clip-path clips absolutely
// positioned descendants too) — but single-select with no "add" row, since
// a model that isn't in the catalog can't be routed to.
export function ModelCombobox({
  models,
  value,
  onChange,
}: {
  models: GatewayModelOption[]
  value: GatewayModelOption | null
  onChange: (model: GatewayModelOption) => void
}) {
  const [query, setQuery] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [keyboardActive, setKeyboardActive] = React.useState(false)
  const listboxId = React.useId()
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const [menuRect, setMenuRect] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const trimmed = query.trim().toLowerCase()
  const suggestions = models.filter(
    (model) =>
      model.name.toLowerCase().includes(trimmed) || model.id.toLowerCase().includes(trimmed)
  )
  const open = focused && suggestions.length > 0
  // Typing can shrink the list under the last keyboard position.
  const active = Math.min(activeIndex, suggestions.length - 1)

  const pick = (model: GatewayModelOption) => {
    onChange(model)
    setQuery("")
    setActiveIndex(0)
    setKeyboardActive(false)
    setFocused(false)
  }

  // Runs before paint so the portaled menu never flashes at (0,0) on open;
  // re-measures on scroll/resize while open since a fixed-position element
  // doesn't move with the page on its own.
  React.useLayoutEffect(() => {
    if (!open) return
    const updateRect = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuRect({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    updateRect()
    window.addEventListener("scroll", updateRect, true)
    window.addEventListener("resize", updateRect)
    return () => {
      window.removeEventListener("scroll", updateRect, true)
      window.removeEventListener("resize", updateRect)
    }
  }, [open])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setKeyboardActive(true)
      setActiveIndex((active + 1) % suggestions.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setKeyboardActive(true)
      setActiveIndex((active - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      pick(suggestions[active])
    } else if (event.key === "Escape") {
      event.currentTarget.blur()
    }
  }

  return (
    <>
      <div ref={anchorRef}>
        <PillInput
          label="Model"
          fieldSize="md"
          icon={<MagnifyingGlass weight="bold" />}
          // The picked model shows as the placeholder rather than the input's
          // value, so the field stays a live search box — clicking back into
          // it to change your mind doesn't mean clearing text first.
          placeholder={value ? value.name : `Search ${models.length} models`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && keyboardActive ? `${listboxId}-${active}` : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setFocused(true)
            setKeyboardActive(false)
          }}
          onBlur={() => setFocused(false)}
        />
      </div>

      {open && menuRect
        ? createPortal(
            <div
              style={{
                position: "fixed",
                top: menuRect.top,
                left: menuRect.left,
                width: menuRect.width,
              }}
              // Above DialogContent's own layer — this menu belongs to a
              // field inside the dialog and has to paint over it.
              className="z-[60]"
            >
              <Menu
                id={listboxId}
                role="listbox"
                aria-label="Models"
                // preventDefault keeps focus on the input while an option is
                // clicked — otherwise the input's blur closes the menu before
                // the click lands.
                onMouseDown={(event) => event.preventDefault()}
                containerClassName="transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
                className="max-h-70"
              >
                {suggestions.map((model, index) => {
                  const price = formatPrice(model.inputPricePerToken)
                  return (
                    <MenuItem
                      key={model.id}
                      id={`${listboxId}-${index}`}
                      role="option"
                      aria-selected={model.id === value?.id}
                      highlighted={keyboardActive && index === active}
                      withDivider={index > 0}
                      onClick={() => pick(model)}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-dist-md">
                        <span className="truncate">{model.name}</span>
                        {price ? (
                          <span className="ml-auto shrink-0 text-body-md text-text-subtle">
                            {price}
                          </span>
                        ) : null}
                      </span>
                    </MenuItem>
                  )
                })}
              </Menu>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
