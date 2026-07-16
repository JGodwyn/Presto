"use client"

import * as React from "react"
import { Plus } from "@phosphor-icons/react"

import {
  addFileWritingStyle,
  addTextWritingStyle,
  addUrlWritingStyle,
} from "@/app/projects/[projectId]/instructions/writing-style-actions"
import { Button } from "@/components/ui/button"
import { PillTextarea } from "@/components/ui/pill-textarea"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UploadDropzone } from "@/components/instructions/upload-dropzone"
import type { WritingStyle } from "@/types/writing-style"

type StyleTab = "type" | "url" | "upload"

const STYLE_TABS: { value: StyleTab; label: string }[] = [
  { value: "type", label: "Type" },
  { value: "url", label: "URL" },
  { value: "upload", label: "Upload" },
]

const TEXTAREA_PLACEHOLDERS: Record<Exclude<StyleTab, "upload">, string> = {
  type: "Type out a real example of a post",
  url: "Paste a post URL or a link with multiple posts for Presto to read.",
}

// The "Add a style" modal from the Figma "Instruction Modal - Type/URL/Upload"
// exports, persisting to public.writing_styles on Save. The trigger swaps
// shape per the Figma "My writing style (Content added)" export: a full
// labeled button for the empty state, an icon-only "+" once the card already
// lists entries (compact) — see components/instructions/writing-style-card.tsx.
function WritingStyleModal({
  projectId,
  onAdded,
  compact = false,
}: {
  projectId: string
  onAdded: (style: WritingStyle) => void
  compact?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState<StyleTab>("type")
  const [typeValue, setTypeValue] = React.useState("")
  const [urlValue, setUrlValue] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const reset = () => {
    setTab("type")
    setTypeValue("")
    setUrlValue("")
    setFile(null)
    setError(null)
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)

    const result =
      tab === "type"
        ? await addTextWritingStyle({ projectId, content: typeValue })
        : tab === "url"
          ? await addUrlWritingStyle({ projectId, content: urlValue })
          : await saveFile(projectId, file)

    setSaving(false)

    if ("error" in result) {
      setError(result.error)
      return
    }

    onAdded(result.style)
    setOpen(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          compact ? (
            <Button variant="brand" size="icon-sm" />
          ) : (
            <Button variant="brand" size="sm" className="self-start" />
          )
        }
      >
        <Plus weight="bold" />
        {compact ? <span className="sr-only">Add a style</span> : "Add a style"}
      </DialogTrigger>

      <DialogContent popupClassName="w-90">
        <DialogTitle>Writing style</DialogTitle>
        <DialogDescription>
          Show Presto real examples of writing you want your posts to sound
          like.
        </DialogDescription>

        <SegmentedControl
          items={STYLE_TABS}
          value={tab}
          onValueChange={(value) => setTab(value as StyleTab)}
        />

        {/* key'd per tab so each panel gets the codebase's small starting:
            entrance when swapped in (mount-in only, no exit). */}
        <div
          key={tab}
          className="transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
        >
          {tab === "upload" ? (
            <UploadDropzone file={file} onFileChange={setFile} />
          ) : (
            <PillTextarea
              placeholder={TEXTAREA_PLACEHOLDERS[tab]}
              value={tab === "type" ? typeValue : urlValue}
              onChange={(event) =>
                tab === "type"
                  ? setTypeValue(event.target.value)
                  : setUrlValue(event.target.value)
              }
            />
          )}
        </div>

        {error ? (
          <p className="text-body-md text-text-danger">{error}</p>
        ) : null}

        <Button
          variant="brand"
          size="xl"
          className="w-full"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

async function saveFile(projectId: string, file: File | null) {
  if (!file) return { error: "Choose a file to upload." }
  const formData = new FormData()
  formData.set("projectId", projectId)
  formData.set("file", file)
  return addFileWritingStyle(formData)
}

export { WritingStyleModal }
