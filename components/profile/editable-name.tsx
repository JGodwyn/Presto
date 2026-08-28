"use client"

import * as React from "react"
import { PencilSimple } from "@phosphor-icons/react"

import { updateDisplayName } from "@/app/projects/[projectId]/profile/account-actions"
import { Toast } from "@/components/ui/toast"
import { ToastSlot } from "@/components/shared/toast-slot"
import { withNetworkStatus } from "@/lib/network-status"
import { cn } from "@/lib/utils"

const MAX_NAME_LENGTH = 80

// Shared by the heading and the input so the two are typographically
// identical — otherwise the text visibly shifts the moment editing starts.
const NAME_TEXT = "text-heading-sm font-display text-text-bold"

// The name on Profile, edited in place. Hovering reveals a pencil; clicking
// puts a caret at the **end** of the existing name rather than selecting it —
// the common case is appending or fixing a character, not retyping.
export function EditableName({
  projectId,
  name,
}: {
  projectId: string
  name: string
}) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(name)
  const [toastOpen, setToastOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  // The last value the server accepted, so a blur that changed nothing doesn't
  // fire a save. A ref, not state: nothing renders from it.
  const savedName = React.useRef(name)

  // A callback ref rather than an effect: the input only exists once editing
  // starts, so this fires exactly when the node is attached — and it's also
  // where the caret gets placed, which has to happen after focus.
  const focusAtEnd = React.useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node
    if (!node) return
    node.focus()
    const end = node.value.length
    node.setSelectionRange(end, end)
  }, [])

  const commit = async () => {
    setEditing(false)
    const next = value.trim()

    // Same rule as every other required field here: clearing it reverts to the
    // last saved value rather than attempting an empty save.
    if (!next) {
      setValue(savedName.current)
      return
    }
    if (next === savedName.current) {
      setValue(next)
      return
    }
    setValue(next)

    const result = await withNetworkStatus(
      updateDisplayName({ projectId, name: next })
    )
    // null = never reached the server; the disconnected toast covers it.
    if (result === null) return
    if ("error" in result) {
      setValue(savedName.current)
      setToastOpen(true)
      return
    }
    savedName.current = next
  }

  return (
    <>
      <ToastSlot>
        <Toast
          open={toastOpen}
          onOpenChange={setToastOpen}
          variant="danger"
          direction="top"
        >
          Couldn&apos;t save your name
        </Toast>
      </ToastSlot>

      {editing ? (
        <input
          ref={focusAtEnd}
          value={value}
          maxLength={MAX_NAME_LENGTH}
          aria-label="Your name"
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              // Blur rather than committing directly, so the one commit path
              // is the blur handler and Enter can't double-save.
              inputRef.current?.blur()
            }
            if (event.key === "Escape") {
              setValue(savedName.current)
              setEditing(false)
            }
          }}
          className={cn(
            NAME_TEXT,
            // Borderless and transparent: the field *is* the heading, so the
            // only thing that changes on click is the caret.
            "w-full bg-transparent text-center outline-none"
          )}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit your name, currently ${value}`}
          className="group/name flex w-full cursor-text justify-center"
        >
          {/* **The pencil is out of flow, and that's the point.** `opacity-0`
              hides a thing but still reserves its width, so as a flex sibling
              it pushed the name off-centre by half the icon-plus-gap — which
              is why the name only looked right once editing swapped in an
              input that had no icon. Absolutely positioned against the text's
              own box, it hangs off the right edge and contributes nothing to
              centring, at any name length.

              min-w-0 + truncate so a very long name can't widen the column. */}
          <span className="relative block min-w-0">
            <span className={cn(NAME_TEXT, "block truncate")}>{value}</span>
            <PencilSimple
              weight="bold"
              className="absolute top-1/2 left-full ml-dist-sm size-4 -translate-y-1/2 text-icon-subtle opacity-0 transition-opacity duration-150 ease group-hover/name:opacity-100 group-focus-visible/name:opacity-100"
            />
          </span>
        </button>
      )}
    </>
  )
}
