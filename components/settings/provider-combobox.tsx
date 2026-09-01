"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import type { GatewayProviderOption } from "@/app/projects/[projectId]/settings/model-actions"
import { Menu, MenuItem } from "@/components/ui/menu"
import { PillInput } from "@/components/ui/pill-input"

// Searchable single-select over the gateway's provider list. The same
// combobox as components/settings/model-combobox.tsx, which is itself
// components/instructions/topic-picker.tsx's — opens on focus, filters as you
// type, arrow/Enter/Escape keyboard nav, portaled menu (every ancestor here
// is squircle-clipped, and clip-path clips absolutely positioned descendants
// too). Two differences from the model twin: no leading search icon, and no
// right-hand price column, since a provider has no single price.
//
// Replaced a SelectPill here. The list is short today (lib/ai/providers.ts
// implements Anthropic only), but it grows one entry per provider added and
// the field is the same either way.
export function ProviderCombobox({
  providers,
  value,
  onChange,
}: {
  providers: GatewayProviderOption[]
  value: string
  onChange: (slug: string) => void
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
  const suggestions = providers.filter(
    (provider) =>
      provider.name.toLowerCase().includes(trimmed) ||
      provider.slug.toLowerCase().includes(trimmed)
  )
  const open = focused && suggestions.length > 0
  // Typing can shrink the list under the last keyboard position.
  const active = Math.min(activeIndex, suggestions.length - 1)
  const selected = providers.find((provider) => provider.slug === value)

  const pick = (provider: GatewayProviderOption) => {
    onChange(provider.slug)
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
          label="Provider"
          fieldSize="md"
          // The picked provider shows as the placeholder rather than the
          // input's value, so the field stays a live search box — clicking
          // back into it to change your mind doesn't mean clearing text first.
          // Which is exactly why the colour has to switch: a real choice
          // sitting in the placeholder slot would otherwise read as unfilled
          // grey prompt text.
          className={selected ? "placeholder:text-text-bold" : undefined}
          placeholder={selected ? selected.name : "Choose provider"}
          role="combobox"
          // The other half of the login-form shape the password manager
          // matches on — see the API key field in add-model-modal.tsx.
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
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
            setFocused(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setFocused(true)
            setKeyboardActive(false)
          }}
          // Picking an option closes the menu but leaves the input focused (the
          // menu's own onMouseDown preventDefault keeps it that way), so a
          // second click fires no focus event and the menu would never reopen.
          // Opening on click as well makes every click open it, focused or not.
          onClick={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            // Bug 2: the chosen value lives in the *placeholder*, so leftover
            // query text visually replaces it while the real selection is
            // unchanged underneath — type gibberish, look away, and the field
            // claims something that was never selected. Clearing on blur makes
            // an unfocused field always show what is actually selected.
            setQuery("")
          }}
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
                aria-label="Providers"
                // preventDefault keeps focus on the input while an option is
                // clicked — otherwise the input's blur closes the menu before
                // the click lands.
                onMouseDown={(event) => event.preventDefault()}
                containerClassName="transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
                className="max-h-70"
              >
                {suggestions.map((provider, index) => (
                  <MenuItem
                    key={provider.slug}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={provider.slug === value}
                    highlighted={keyboardActive && index === active}
                    withDivider={index > 0}
                    onClick={() => pick(provider)}
                  >
                    <span className="truncate">{provider.name}</span>
                  </MenuItem>
                ))}
              </Menu>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
