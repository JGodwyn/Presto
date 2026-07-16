"use client"

import type { FocusEvent } from "react"
import { File, Link, PencilLine, Trash } from "@phosphor-icons/react"

import { updateTextWritingStyle } from "@/app/projects/[projectId]/instructions/writing-style-actions"
import { PillTextarea } from "@/components/ui/pill-textarea"
import { FileTypeIcon } from "@/components/instructions/file-type-icon"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import type { WritingStyle } from "@/types/writing-style"

// Figma --rad-lg/--rad-xmd as px for the squircle path math — see
// hooks/use-squircle-clip-path.ts.
const URL_BOX_CORNER_RADIUS = 16
const FILE_PREVIEW_CORNER_RADIUS = 12

const KIND_LABELS: Record<WritingStyle["kind"], string> = {
  text: "Text",
  url: "URL",
  file: "File",
}

// Figma's frame.json actually reuses "Link" for both url and file entries,
// but that reads wrong for a file attachment — File is the clearer match.
const KIND_ICONS = {
  text: PencilLine,
  url: Link,
  file: File,
} as const

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// One saved writing-style entry (Figma "My writing style (Content added)"
// export): icon + kind label + trash in a header row, then a kind-specific
// content preview below. Only "text" is editable — it's a live textarea that
// saves on blur, same no-save-button convention as My Voice's "Tone" field.
// URL and File stay display-only per product decision.
function WritingStyleEntry({
  style,
  onDelete,
  onSaveFailed,
}: {
  style: WritingStyle
  onDelete: () => void
  onSaveFailed: () => void
}) {
  const KindIcon = KIND_ICONS[style.kind]
  const { ref: urlBoxRef, style: urlBoxStyle } =
    useSquircleClipPath<HTMLAnchorElement>({
      cornerRadius: URL_BOX_CORNER_RADIUS,
    })

  const handleTextBlur = async (event: FocusEvent<HTMLTextAreaElement>) => {
    const value = event.target.value.trim()

    // A required field with no dedicated validation UI here — clearing it
    // reverts to the last saved value instead of attempting an empty save
    // (the DB check constraint would reject it anyway). Deleting the whole
    // entry goes through the trash button, not an emptied textarea.
    if (!value) {
      event.target.value = style.content ?? ""
      return
    }
    if (value === style.content) return

    const result = await updateTextWritingStyle({
      projectId: style.projectId,
      id: style.id,
      content: value,
    })
    if ("error" in result) onSaveFailed()
  }

  return (
    <div className="flex flex-col gap-dist-md">
      <div className="flex items-center gap-dist-lg">
        <div className="flex flex-1 items-center gap-dist-sm">
          <KindIcon className="size-5 shrink-0 text-text-bold" weight="bold" />
          <h3 className="text-body-lg-bold text-text-bold">
            {KIND_LABELS[style.kind]}
          </h3>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete this ${KIND_LABELS[style.kind].toLowerCase()} style`}
          className="shrink-0 cursor-pointer text-icon-subtle transition-colors duration-150 ease outline-none hover:text-icon-danger focus-visible:text-icon-danger"
        >
          <Trash className="size-5" weight="bold" />
        </button>
      </div>

      {style.kind === "file" ? (
        <FileStylePreview
          fileName={style.fileName ?? "File"}
          fileSize={style.fileSize ?? 0}
        />
      ) : style.kind === "url" ? (
        <a
          ref={urlBoxRef}
          style={urlBoxStyle}
          href={style.content ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-pad-2xl w-full items-center overflow-hidden rounded-rad-lg bg-text-input-surface-rest px-pad-md transition-colors duration-150 ease hover:bg-surface-2"
        >
          <span className="truncate text-body-lg text-text-bold">
            {style.content}
          </span>
        </a>
      ) : (
        <PillTextarea
          defaultValue={style.content ?? ""}
          onBlur={handleTextBlur}
          className="h-26"
        />
      )}
    </div>
  )
}

function FileStylePreview({
  fileName,
  fileSize,
}: {
  fileName: string
  fileSize: number
}) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: FILE_PREVIEW_CORNER_RADIUS,
  })

  return (
    <div
      ref={ref}
      style={style}
      className="flex items-center gap-dist-md rounded-rad-xmd border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 p-pad-md"
    >
      <FileTypeIcon fileName={fileName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-body-lg text-text-bold">{fileName}</p>
        <p className="text-body-md text-text-subtle">
          {formatFileSize(fileSize)}
        </p>
      </div>
    </div>
  )
}

export { WritingStyleEntry }
