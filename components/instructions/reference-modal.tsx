"use client"

import * as React from "react"
import { Plus } from "@phosphor-icons/react"

import {
  addFileReference,
  addTextReference,
  addUrlReference,
} from "@/app/projects/[projectId]/instructions/reference-actions"
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
import { FieldError } from "@/components/instructions/field-error"
import { UploadDropzone } from "@/components/instructions/upload-dropzone"
import type { ContentReference } from "@/types/content-reference"

// Mirrors writing-style-modal.tsx exactly — References works the same way
// My writing style does: same Type/URL/Upload tabs, same trigger-swap
// behavior, same UploadDropzone. Only the copy and the target table differ.
type ReferenceTab = "type" | "url" | "upload"

const REFERENCE_TABS: { value: ReferenceTab; label: string }[] = [
  { value: "type", label: "Type" },
  { value: "url", label: "URL" },
  { value: "upload", label: "Upload" },
]

const TEXTAREA_PLACEHOLDERS: Record<Exclude<ReferenceTab, "upload">, string> = {
  type: "Type out reference material for Presto to draw from",
  url: "Paste a link Presto can pull context from.",
}

// The "Add a reference" modal — trigger swaps shape per
// components/instructions/reference-card.tsx: a full labeled button for the
// empty state, an icon-only "+" once the card already lists entries
// (compact).
function ReferenceModal({
  projectId,
  onAdded,
  compact = false,
}: {
  projectId: string
  onAdded: (reference: ContentReference) => void
  compact?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState<ReferenceTab>("type")
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
        ? await addTextReference({ projectId, content: typeValue })
        : tab === "url"
          ? await addUrlReference({ projectId, content: urlValue })
          : await saveFile(projectId, file)

    setSaving(false)

    if ("error" in result) {
      setError(result.error)
      return
    }

    onAdded(result.reference)
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
        {compact ? (
          <span className="sr-only">Add a reference</span>
        ) : (
          "Add a reference"
        )}
      </DialogTrigger>

      <DialogContent popupClassName="w-90">
        <DialogTitle>Reference</DialogTitle>
        <DialogDescription>
          Give Presto material to draw ideas and context from when generating
          posts.
        </DialogDescription>

        <SegmentedControl
          items={REFERENCE_TABS}
          value={tab}
          // Clears any leftover error from a failed save on the tab being
          // left — otherwise it can still be showing (e.g. "Enter a valid
          // URL") after switching to Upload, on top of that tab's own
          // rejection message.
          onValueChange={(value) => {
            setTab(value as ReferenceTab)
            setError(null)
          }}
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
              // `error` is always about whichever tab was active when it was
              // set, and gets cleared on tab switch (see onValueChange
              // above), so it's never stale here.
              aria-invalid={!!error}
            />
          )}
        </div>

        {/* -mt to pull it a little closer to the field above than
            DialogContent's own gap-dist-lg leaves by default. */}
        {error ? <FieldError message={error} className="-mt-dist-sm" /> : null}

        <Button
          variant="brand"
          size="xl"
          className="w-full"
          // Disabled until the active tab actually has something to save —
          // empty Type/URL text, or no file picked (including just-rejected
          // by UploadDropzone, which clears `file` back to null). Otherwise
          // clicking Save still flashes "Saving…" for a tick before the
          // server action's own validation error comes back.
          disabled={
            saving ||
            (tab === "type"
              ? !typeValue.trim()
              : tab === "url"
                ? !urlValue.trim()
                : !file)
          }
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
  return addFileReference(formData)
}

export { ReferenceModal }
