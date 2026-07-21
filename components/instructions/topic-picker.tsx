"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { MagnifyingGlass, Plus } from "@phosphor-icons/react"

import { Chip } from "@/components/ui/chip"
import { Menu, MenuItem } from "@/components/ui/menu"
import { PillInput } from "@/components/ui/pill-input"

// A topic can be up to 80 chars in the DB, but nothing on this card is wide
// enough to show that much text on one line — cap what's ever rendered
// (chip, suggestion, or the "Add …" preview) well short of that, regardless
// of the container's own width, rather than leaning on CSS truncate alone.
const TOPIC_DISPLAY_MAX_LENGTH = 32

function truncateTopic(topic: string) {
  return topic.length > TOPIC_DISPLAY_MAX_LENGTH
    ? `${topic.slice(0, TOPIC_DISPLAY_MAX_LENGTH).trimEnd()}…`
    : topic
}

// Starter list shown before the user types — topics the connected model will
// later search for context on. Custom entries typed by the user sit alongside
// these; nothing distinguishes them once added.
const COMMON_TOPICS = [
  "Artificial intelligence",
  "Startups",
  "Entrepreneurship",
  "Marketing",
  "Sales",
  "Product management",
  "Design",
  "Engineering",
  "Leadership",
  "Career growth",
  "Personal branding",
  "Productivity",
  "Remote work",
  "Company culture",
  "Hiring",
  "Finance",
  "Freelancing",
  "Customer success",
] as const

// Combobox for the "Topic covered" section: the menu opens on focus with the
// common topics, filters as the user types, and offers an Add "…" row when
// the input matches nothing — added topics render as removable chips that
// wrap below the field. Selection state lives in the parent (MyVoiceCard),
// which also owns saving.
export function TopicPicker({
  topics,
  onAdd,
  onRemove,
}: {
  topics: string[]
  onAdd: (topic: string) => void
  onRemove: (topic: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  // The highlighted-row border shouldn't appear the instant the menu opens —
  // only once the user actually starts moving through the list with the
  // keyboard. Enter still commits the top match either way (standard
  // combobox behavior), it just doesn't render as pre-selected up front.
  const [keyboardActive, setKeyboardActive] = React.useState(false)
  const listboxId = React.useId()
  const anchorRef = React.useRef<HTMLDivElement>(null)
  // The dropdown is portaled straight to <body> (below) rather than
  // positioned relative to anchorRef in normal flow: this field lives inside
  // InstructionsCard, whose squircle corners are done with a clip-path on
  // the card itself — and clip-path clips *all* descendants, including
  // absolutely positioned ones, so an in-place dropdown gets cut off at the
  // card's own edge instead of floating over the rest of the page. A portal
  // escapes that ancestor entirely; menuRect is where it gets pinned.
  const [menuRect, setMenuRect] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const trimmed = query.trim()
  const added = new Set(topics.map((t) => t.toLowerCase()))
  const suggestions = COMMON_TOPICS.filter(
    (t) =>
      !added.has(t.toLowerCase()) &&
      t.toLowerCase().includes(trimmed.toLowerCase())
  )
  // The Add "…" row appears only when the typed text is neither a common
  // topic nor already added — an exact match should be picked, not duplicated.
  const canCreate =
    trimmed !== "" &&
    !added.has(trimmed.toLowerCase()) &&
    !COMMON_TOPICS.some((t) => t.toLowerCase() === trimmed.toLowerCase())
  const optionCount = suggestions.length + (canCreate ? 1 : 0)
  const open = focused && optionCount > 0
  // Typing can shrink the list under the last keyboard position.
  const active = Math.min(activeIndex, optionCount - 1)

  const pick = (topic: string) => {
    onAdd(topic)
    setQuery("")
    setActiveIndex(0)
    setKeyboardActive(false)
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
      setActiveIndex((active + 1) % optionCount)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setKeyboardActive(true)
      setActiveIndex((active - 1 + optionCount) % optionCount)
    } else if (event.key === "Enter") {
      event.preventDefault()
      pick(active < suggestions.length ? suggestions[active] : trimmed)
    } else if (event.key === "Escape") {
      event.currentTarget.blur()
    }
  }

  return (
    <>
      <div ref={anchorRef}>
        <PillInput
          fieldSize="md"
          icon={<MagnifyingGlass weight="bold" />}
          placeholder="Search topics to add"
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
              // Positioning lives on this wrapper (computed in JS, since the
              // menu is no longer a normal-flow descendant of the anchor);
              // Menu's own containerClassName stays free for its visual
              // concerns (shadow, mount-in transition) only.
              style={{
                position: "fixed",
                top: menuRect.top,
                left: menuRect.left,
                width: menuRect.width,
              }}
              className="z-50"
            >
              <Menu
                id={listboxId}
                role="listbox"
                aria-label="Topic suggestions"
                // preventDefault keeps focus on the input while an option is
                // clicked — otherwise the input's blur closes the menu
                // before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                containerClassName="transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
                className="max-h-70"
              >
                {suggestions.map((topic, index) => (
                  <MenuItem
                    key={topic}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    highlighted={keyboardActive && index === active}
                    withDivider={index > 0}
                    onClick={() => pick(topic)}
                  >
                    {truncateTopic(topic)}
                  </MenuItem>
                ))}
                {canCreate ? (
                  <MenuItem
                    id={`${listboxId}-${suggestions.length}`}
                    role="option"
                    aria-selected={active === suggestions.length}
                    highlighted={
                      keyboardActive && active === suggestions.length
                    }
                    withDivider={suggestions.length > 0}
                    onClick={() => pick(trimmed)}
                  >
                    <Plus className="size-4 shrink-0" weight="bold" />
                    {/* min-w-0 flex row so only the typed text truncates —
                        the closing quote stays visible however long the
                        input gets. */}
                    <span className="flex min-w-0 items-center">
                      <span className="shrink-0">Add&nbsp;&ldquo;</span>
                      <span className="truncate font-bold">
                        {truncateTopic(trimmed)}
                      </span>
                      <span className="shrink-0">&rdquo;</span>
                    </span>
                  </MenuItem>
                ) : null}
              </Menu>
            </div>,
            document.body
          )
        : null}

      {topics.length > 0 ? (
        <div className="flex flex-wrap gap-dist-md">
          {topics.map((topic) => (
            // Enter-only mount-in (CSS @starting-style, no JS) — removal is
            // instant, on purpose: an exit fade was tried here repeatedly
            // and never stopped reading as "a delay before it goes away" no
            // matter how early the transition started, since the chip is
            // still visibly on screen, fading, for the whole duration
            // either way. Tapping now removes the chip on the very same
            // frame.
            <div
              key={topic}
              className="transition-[opacity,filter,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-90 starting:opacity-0 starting:blur-[8px]"
            >
              <Chip title={topic} onRemove={() => onRemove(topic)}>
                {truncateTopic(topic)}
              </Chip>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-body-lg text-text-minimal">No topics added</p>
      )}
    </>
  )
}
