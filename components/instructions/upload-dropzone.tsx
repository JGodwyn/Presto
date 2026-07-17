"use client"

import * as React from "react"
import { CheckCircle, UploadSimple } from "@phosphor-icons/react"

import { FieldError } from "@/components/instructions/field-error"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"

// Figma --rad-xmd for the upload dropzone, as px for the squircle path math —
// see hooks/use-squircle-clip-path.ts.
const DROPZONE_CORNER_RADIUS = 12

// Matches Next's own default Server Actions body-size limit exactly
// (1024 * 1024, see node_modules/next/dist/server/app-render/action-handler.js)
// — anything at or above this gets rejected by the framework itself before
// our server action's own validation ever runs, as an opaque 500. Checking
// here means the user sees a real message instead of that.
const MAX_FILE_BYTES = 1024 * 1024

// The "Upload" tab of the writing-style/reference modals: a surface-3 well
// the height of its sibling textarea while empty. Once a file is picked, the
// upload icon swaps for the "Instruction Modal - Upload successful" export's
// green check (Phosphor CheckCircle fill happens to be the exact same hex as
// --icon-success, sized up from the export) and the filename switches to the
// bold text style — the helper caption underneath stays as-is either way.
// The box grows past that fixed height in this state (min-h-30, not h-30)
// so the larger check icon doesn't clip the filename below it.
//
// A too-large file never reaches `onFileChange` at all — it's rejected right
// here (border-border-danger + a warning message underneath) rather than
// being handed to the caller and failing later at Save. The caller still
// needs to disable its own Save button while `file` is null on this tab
// (see writing-style-modal.tsx/reference-modal.tsx) — otherwise clicking
// Save on a rejected/empty upload briefly flashes "Saving…" before the
// server action's own "choose a file" error comes back.
function UploadDropzone({
  file,
  onFileChange,
}: {
  file: File | null
  onFileChange: (file: File | null) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [oversized, setOversized] = React.useState(false)
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: DROPZONE_CORNER_RADIUS,
  })

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null

    if (selected && selected.size >= MAX_FILE_BYTES) {
      setOversized(true)
      onFileChange(null)
      // Without this, picking the same oversized file again wouldn't fire
      // another change event (the input's value never actually changed).
      event.target.value = ""
      return
    }

    setOversized(false)
    onFileChange(selected)
  }

  return (
    <div className="flex flex-col gap-dist-sm">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        ref={ref}
        style={style}
        onClick={() => inputRef.current?.click()}
        className={cn(
          // h-30 matches the sibling textarea only for the empty prompt —
          // once a file's picked, the (much bigger) check icon no longer
          // fits that fixed height, so min-h-30 lets the box grow instead of
          // clipping the filename underneath it.
          "flex w-full cursor-pointer flex-col items-center justify-center gap-dist-sm rounded-rad-xmd border-[length:var(--stroke-xl)] bg-surface-3 px-pad-sm py-pad-xl transition-colors duration-150 ease outline-none hover:bg-surface-2",
          file ? "min-h-30" : "h-30",
          // Same if/else exclusion pill-input.tsx uses for danger vs. focus
          // border color — including both risks the wrong one winning,
          // since they're equal-specificity classes whose actual precedence
          // depends on Tailwind's generated stylesheet order, not JSX order.
          oversized
            ? "border-border-danger"
            : "border-border-subtle focus-visible:border-border-focused"
        )}
      >
        {file ? (
          <CheckCircle weight="fill" className="size-8 text-icon-success" />
        ) : (
          <UploadSimple className="size-5 text-text-bold" />
        )}
        <span
          className={cn(
            "w-full truncate text-text-bold",
            file ? "text-body-lg-bold" : "text-body-lg"
          )}
        >
          {file?.name ?? "Tap to upload a file"}
        </span>
        <span className="text-body-md text-text-subtle">
          Supports PDF, Word, TXT files
        </span>
      </button>
      {oversized ? <FieldError message="Keep your files less than 1MB" /> : null}
    </div>
  )
}

export { UploadDropzone }
