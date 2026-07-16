"use client"

import * as React from "react"
import { CheckCircle, UploadSimple } from "@phosphor-icons/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"

// Figma --rad-xmd for the upload dropzone, as px for the squircle path math —
// see hooks/use-squircle-clip-path.ts.
const DROPZONE_CORNER_RADIUS = 12

// The "Upload" tab of the writing-style modal (components/instructions/
// writing-style-modal.tsx): a surface-3 well the height of its sibling
// textarea while empty. Once a file is picked, the upload icon swaps for the
// "Instruction Modal - Upload successful" export's green check (Phosphor
// CheckCircle fill happens to be the exact same hex as --icon-success,
// sized up from the export) and the filename switches to the bold text
// style — the helper caption underneath stays as-is either way. The box
// grows past that fixed height in this state (min-h-30, not h-30) so the
// larger check icon doesn't clip the filename below it.
function UploadDropzone({
  file,
  onFileChange,
}: {
  file: File | null
  onFileChange: (file: File | null) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: DROPZONE_CORNER_RADIUS,
  })

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
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
          "flex w-full cursor-pointer flex-col items-center justify-center gap-dist-sm rounded-rad-xmd border-[length:var(--stroke-xl)] border-border-subtle bg-surface-3 px-pad-sm py-pad-xl transition-colors duration-150 ease outline-none hover:bg-surface-2 focus-visible:border-border-focused",
          file ? "min-h-30" : "h-30"
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
    </>
  )
}

export { UploadDropzone }
